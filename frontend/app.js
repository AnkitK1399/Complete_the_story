// API Configuration
const API_BASE = "http://localhost:8000/api";

// Application State
let appState = {
    stories: [],
    activeStory: null,
    currentNodeId: null,
    pollingInterval: null
};

// DOM Elements
const views = {
    lobby: document.getElementById("lobby-view"),
    loader: document.getElementById("loader-view"),
    game: document.getElementById("game-view")
};

const elements = {
    generatorForm: document.getElementById("story-generator-form"),
    themeInput: document.getElementById("story-theme-input"),
    btnGenerate: document.getElementById("btn-generate-story"),
    lblStoryCount: document.getElementById("lbl-story-count"),
    pastStoriesGrid: document.getElementById("past-stories-grid"),
    
    // Loader Elements
    lblLoaderStatus: document.getElementById("lbl-loader-status"),
    stepTask: document.getElementById("step-task"),
    stepAI: document.getElementById("step-ai"),
    stepValidation: document.getElementById("step-validation"),
    stepDB: document.getElementById("step-db"),
    
    // Game Elements
    btnExitGame: document.getElementById("btn-exit-game"),
    lblGameTitle: document.getElementById("lbl-game-story-title"),
    lblGameTheme: document.getElementById("lbl-game-story-theme"),
    cardNarrative: document.getElementById("card-narrative-panel"),
    lblNodeTitle: document.getElementById("lbl-node-title"),
    lblNodeContent: document.getElementById("lbl-node-content"),
    lblOptionsHeader: document.getElementById("lbl-options-header"),
    choicesList: document.getElementById("choices-list"),
    bannerWin: document.getElementById("banner-victory-state"),
    bannerLoss: document.getElementById("banner-defeat-state"),
    panelEndActions: document.getElementById("panel-game-end-actions"),
    btnRestart: document.getElementById("btn-restart-adventure"),
    btnLobby: document.getElementById("btn-back-to-lobby")
};

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
    switchView("lobby");
    loadPastStories();
    setupEventListeners();
});

// Setup Events
function setupEventListeners() {
    // Generate Form Submit
    elements.generatorForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const theme = elements.themeInput.value.trim();
        if (theme) {
            triggerStoryGeneration(theme);
        }
    });

    // Quick Starts / Suggestions
    document.querySelectorAll(".btn-suggestion").forEach(btn => {
        btn.addEventListener("click", () => {
            const theme = btn.getAttribute("data-theme");
            elements.themeInput.value = theme;
            triggerStoryGeneration(theme);
        });
    });

    // Exit Game Button
    elements.btnExitGame.addEventListener("click", () => {
        switchView("lobby");
        loadPastStories();
    });

    // Lobby Button at End Game
    elements.btnLobby.addEventListener("click", () => {
        switchView("lobby");
        loadPastStories();
    });

    // Restart Adventure
    elements.btnRestart.addEventListener("click", () => {
        if (appState.activeStory) {
            playStory(appState.activeStory);
        }
    });
}

// Navigation Helper
function switchView(viewName) {
    Object.keys(views).forEach(key => {
        if (key === viewName) {
            views[key].classList.add("active");
        } else {
            views[key].classList.remove("active");
        }
    });
}

// Load Stories Grid
async function loadPastStories() {
    try {
        const response = await fetch(`${API_BASE}/stories/`);
        if (!response.ok) throw new Error("Failed to fetch stories");
        
        const data = await response.json();
        appState.stories = data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        renderStoriesGrid();
    } catch (error) {
        console.error("Error loading past stories:", error);
        elements.pastStoriesGrid.innerHTML = `
            <div class="glass-card" style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
                <i class="fa-solid fa-triangle-exclamation" style="color: #f59e0b; font-size: 2rem; margin-bottom: 1rem;"></i>
                <p>Could not connect to the backend server. Make sure your FastAPI server is running.</p>
            </div>
        `;
    }
}

// Render Stories Grid
function renderStoriesGrid() {
    elements.lblStoryCount.textContent = `${appState.stories.length} ${appState.stories.length === 1 ? 'story' : 'stories'}`;
    
    if (appState.stories.length === 0) {
        elements.pastStoriesGrid.innerHTML = `
            <div class="glass-card" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                <i class="fa-regular fa-folder-open" style="font-size: 2.5rem; color: var(--color-text-muted); margin-bottom: 1rem;"></i>
                <p style="color: var(--color-text-secondary);">No adventures have been written yet. Be the first to create one!</p>
            </div>
        `;
        return;
    }
    
    elements.pastStoriesGrid.innerHTML = appState.stories.map(story => {
        const date = new Date(story.created_at).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        return `
            <div class="story-card" onclick="loadAndPlayStory('${story.id}')">
                <div class="story-card-top">
                    <h3>${escapeHTML(story.title)}</h3>
                    <p>${escapeHTML(story.theme)}</p>
                </div>
                <div class="story-card-footer">
                    <span><i class="fa-regular fa-calendar-days"></i> ${date}</span>
                    <span class="play-badge">Play <i class="fa-solid fa-play"></i></span>
                </div>
            </div>
        `;
    }).join("");
}

// Fetch Story & Play
async function loadAndPlayStory(storyId) {
    try {
        const response = await fetch(`${API_BASE}/stories/${storyId}`);
        if (!response.ok) throw new Error("Story not found");
        
        const story = await response.json();
        playStory(story);
    } catch (error) {
        alert("Failed to load story detail. Check backend server.");
    }
}

// Submit Theme to Queue
async function triggerStoryGeneration(theme) {
    switchView("loader");
    resetLoaderSteps();
    updateLoaderText("Sending request to adventure queue...", "task");
    
    try {
        const response = await fetch(`${API_BASE}/stories/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ theme })
        });
        
        if (!response.ok) throw new Error("Failed to dispatch task");
        
        const task = await response.json();
        setStepCompleted("step-task");
        
        // Start Polling Celery task
        startPolling(task.task_id);
    } catch (error) {
        updateLoaderText("Error: Failed to connect to the backend queue.", "task");
        setTimeout(() => switchView("lobby"), 4000);
    }
}

// Celery Polling
function startPolling(taskId) {
    if (appState.pollingInterval) clearInterval(appState.pollingInterval);
    
    let dots = 0;
    let stepCount = 0;
    
    appState.pollingInterval = setInterval(async () => {
        dots = (dots + 1) % 4;
        const loadingDots = ".".repeat(dots);
        
        try {
            const response = await fetch(`${API_BASE}/stories/tasks/${taskId}`);
            if (!response.ok) throw new Error("Polling error");
            
            const task = await response.json();
            
            if (task.status === "PENDING" || task.status === "STARTED") {
                stepCount++;
                if (stepCount < 4) {
                    updateLoaderText(`AI is drafting plot outlines${loadingDots}`, "ai");
                } else if (stepCount < 8) {
                    setStepCompleted("step-ai");
                    updateLoaderText(`Validating story choices and branches${loadingDots}`, "validation");
                } else {
                    setStepCompleted("step-validation");
                    updateLoaderText(`Finalizing details and saving session${loadingDots}`, "db");
                }
            } else if (task.status === "SUCCESS") {
                clearInterval(appState.pollingInterval);
                setStepCompleted("step-ai");
                setStepCompleted("step-validation");
                setStepCompleted("step-db");
                updateLoaderText("Adventure Ready!", "db");
                
                appState.activeStory = task.result;
                setTimeout(() => playStory(task.result), 800);
            } else if (task.status === "FAILURE") {
                clearInterval(appState.pollingInterval);
                updateLoaderText(`Generation Failed: ${task.error || 'Unknown AI error'}`, "");
                setTimeout(() => switchView("lobby"), 4000);
            }
        } catch (error) {
            clearInterval(appState.pollingInterval);
            updateLoaderText("Connection interrupted while polling task.", "");
            setTimeout(() => switchView("lobby"), 4000);
        }
    }, 1500);
}

// Loader UI helpers
function resetLoaderSteps() {
    document.querySelectorAll(".polling-step").forEach(step => {
        step.classList.remove("active", "completed");
        const icon = step.querySelector(".step-icon");
        icon.className = "fa-regular fa-circle step-icon";
    });
}

function updateLoaderText(text, activeStepId) {
    elements.lblLoaderStatus.textContent = text;
    if (activeStepId) {
        const step = document.getElementById(`step-${activeStepId}`);
        if (step) {
            step.classList.add("active");
        }
    }
}

function setStepCompleted(stepElementId) {
    const step = document.getElementById(stepElementId);
    if (step) {
        step.classList.add("completed");
        step.classList.remove("active");
        const icon = step.querySelector(".step-icon");
        icon.className = "fa-regular fa-circle-check step-icon";
    }
}

// Interactive Story Game Core
function playStory(story) {
    appState.activeStory = story;
    elements.lblGameTitle.textContent = story.title;
    elements.lblGameTheme.textContent = story.theme;
    
    switchView("game");
    renderStoryNode(story.root_node_id);
}

// Render Story Page/Node
function renderStoryNode(nodeId) {
    appState.currentNodeId = nodeId;
    const node = appState.activeStory.nodes[nodeId];
    
    if (!node) {
        console.error(`Node ${nodeId} not found in story nodes`);
        return;
    }
    
    // Fill texts
    elements.lblNodeTitle.textContent = node.title;
    elements.lblNodeContent.textContent = node.content;
    
    // Remove past states classes
    elements.cardNarrative.classList.remove("win-state", "loss-state");
    elements.bannerWin.style.display = "none";
    elements.bannerLoss.style.display = "none";
    elements.panelEndActions.style.display = "none";
    elements.lblOptionsHeader.style.display = "block";
    elements.choicesList.style.display = "flex";
    
    // Render Winning / Losing banners and Panels
    if (node.is_winning) {
        elements.cardNarrative.classList.add("win-state");
        elements.bannerWin.style.display = "flex";
        elements.lblOptionsHeader.style.display = "none";
        elements.choicesList.style.display = "none";
        elements.panelEndActions.style.display = "flex";
    } else if (node.is_losing) {
        elements.cardNarrative.classList.add("loss-state");
        elements.bannerLoss.style.display = "flex";
        elements.lblOptionsHeader.style.display = "none";
        elements.choicesList.style.display = "none";
        elements.panelEndActions.style.display = "flex";
    } else {
        // Render Standard Options
        elements.choicesList.innerHTML = node.options.map((option, idx) => {
            return `
                <button class="btn-choice" onclick="renderStoryNode('${option.target_node_id}')">
                    <span>${escapeHTML(option.text)}</span>
                    <i class="fa-solid fa-chevron-right"></i>
                </button>
            `;
        }).join("");
        
        if (node.options.length === 0) {
            // Fallback: If AI leaves a middle node without options, provide a button to return to lobby
            elements.choicesList.innerHTML = `
                <div style="color: var(--color-text-muted); font-size: 0.95rem; margin-bottom: 1rem;">
                    This route seems to have reached a quiet dead end.
                </div>
            `;
            elements.panelEndActions.style.display = "flex";
        }
    }
    
    // Smooth scroll top on change
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Utility Helpers
function escapeHTML(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
