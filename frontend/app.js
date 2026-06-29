// API Configuration
const API_BASE = "http://localhost:8000/api";

// Application State
let appState = {
    token: localStorage.getItem("auth_token") || null,
    currentUser: null,
    stories: [],
    activeStory: null,
    currentNodeId: null,
    pollingInterval: null,
    currentTheme: ""
};

// DOM Elements
const views = {
    auth: document.getElementById("auth-view"),
    lobby: document.getElementById("lobby-view"),
    loader: document.getElementById("loader-view"),
    game: document.getElementById("game-view")
};

const elements = {
    generatorForm: document.getElementById("story-generator-form"),
    themeInput: document.getElementById("story-theme-input"),
    minLevelInput: document.getElementById("story-min-level-input"),
    maxLevelInput: document.getElementById("story-max-level-input"),
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

// Helper for authorized fetches
async function authFetch(url, options = {}) {
    options.headers = options.headers || {};
    if (appState.token) {
        options.headers["Authorization"] = `Bearer ${appState.token}`;
    }
    const response = await fetch(url, options);
    
    if (response.status === 401) {
        logout();
        throw new Error("Unauthorized/Session expired");
    }
    return response;
}

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
    if (appState.token) {
        initDashboard();
    } else {
        switchView("auth");
    }
});

// Setup Events
function setupEventListeners() {
    // Auth Tab Switching
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");

    tabLogin.addEventListener("click", () => {
        tabLogin.classList.add("active");
        tabRegister.classList.remove("active");
        loginForm.classList.add("active");
        registerForm.classList.remove("active");
        document.getElementById("login-error").textContent = "";
        document.getElementById("reg-error").textContent = "";
    });

    tabRegister.addEventListener("click", () => {
        tabRegister.classList.add("active");
        tabLogin.classList.remove("active");
        registerForm.classList.add("active");
        loginForm.classList.remove("active");
        document.getElementById("login-error").textContent = "";
        document.getElementById("reg-error").textContent = "";
    });

    // Login Form Submit
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = document.getElementById("login-username").value.trim();
        const password = document.getElementById("login-password").value;
        const errorMsg = document.getElementById("login-error");
        errorMsg.textContent = "";

        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Invalid username or password");
            }

            const data = await res.json();
            appState.token = data.access_token;
            localStorage.setItem("auth_token", data.access_token);
            
            loginForm.reset();
            await initDashboard();
        } catch (err) {
            errorMsg.textContent = err.message;
        }
    });

    // Register Form Submit
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("reg-name").value.trim();
        const email = document.getElementById("reg-email").value.trim();
        const password = document.getElementById("reg-password").value;
        const mobile = document.getElementById("reg-mobile").value.trim();
        const gender = document.getElementById("reg-gender").value;
        const errorMsg = document.getElementById("reg-error");
        errorMsg.textContent = "";

        try {
            const res = await fetch(`${API_BASE}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password, mobile, gender })
            });

            if (!res.ok) {
                const err = await res.json();
                let errMsg = "Registration failed. Please check inputs.";
                if (err.detail) {
                    if (Array.isArray(err.detail)) {
                        errMsg = err.detail.map(e => {
                            const field = e.loc[e.loc.length - 1];
                            return `${field.charAt(0).toUpperCase() + field.slice(1)}: ${e.msg}`;
                        }).join(", ");
                    } else {
                        errMsg = err.detail;
                    }
                }
                throw new Error(errMsg);
            }

            const data = await res.json();
            
            document.getElementById("generated-username-val").textContent = data.username;
            document.getElementById("reg-success-modal").classList.add("active");
            registerForm.reset();
        } catch (err) {
            errorMsg.textContent = err.message;
        }
    });

    // Proceed to login from success screen
    document.getElementById("btn-proceed-to-login").addEventListener("click", () => {
        document.getElementById("reg-success-modal").classList.remove("active");
        tabLogin.click();
    });

    // Logout Button
    document.getElementById("btn-logout").addEventListener("click", () => {
        logout();
    });

    // Generate Form Submit
    elements.generatorForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const theme = elements.themeInput.value.trim();
        const minLevels = parseInt(elements.minLevelInput.value) || 3;
        const maxLevels = parseInt(elements.maxLevelInput.value) || 4;
        if (minLevels > maxLevels) {
            alert("Maximum levels must be greater than or equal to minimum levels.");
            return;
        }
        if (theme) {
            triggerStoryGeneration(theme, minLevels, maxLevels);
        }
    });

    // Quick Starts / Suggestions
    document.querySelectorAll(".btn-suggestion").forEach(btn => {
        btn.addEventListener("click", () => {
            const theme = btn.getAttribute("data-theme");
            const minLevels = 3;
            const maxLevels = 4;
            elements.themeInput.value = theme;
            elements.minLevelInput.value = minLevels;
            elements.maxLevelInput.value = maxLevels;
            triggerStoryGeneration(theme, minLevels, maxLevels);
        });
    });

    // Exit Game Button
    elements.btnExitGame.addEventListener("click", () => {
        switchView("lobby");
        loadPastStories();
        loadPlayHistory();
        loadScoreboard();
    });

    // Lobby Button at End Game
    elements.btnLobby.addEventListener("click", () => {
        switchView("lobby");
        loadPastStories();
        loadPlayHistory();
        loadScoreboard();
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

function logout() {
    appState.token = null;
    appState.currentUser = null;
    localStorage.removeItem("auth_token");
    if (appState.pollingInterval) {
        clearInterval(appState.pollingInterval);
    }
    document.getElementById("user-header-profile").style.display = "none";
    switchView("auth");
}

async function initDashboard() {
    try {
        const userRes = await authFetch(`${API_BASE}/users/me`);
        if (!userRes.ok) throw new Error("Could not fetch user profile");
        const user = await userRes.json();
        appState.currentUser = user;
        
        document.getElementById("header-user-display").textContent = user.name;
        document.getElementById("header-username-display").textContent = user.username;
        document.getElementById("user-header-profile").style.display = "flex";
        
        document.getElementById("stat-username").textContent = user.username;
        document.getElementById("stat-name").textContent = user.name;
        document.getElementById("stat-score").textContent = user.score;
        document.getElementById("stat-gender").textContent = user.gender;
        document.getElementById("stat-mobile").textContent = user.mobile;
        
        switchView("lobby");
        
        loadPastStories();
        loadScoreboard();
        loadPlayHistory();
    } catch (err) {
        console.error(err);
        logout();
    }
}

async function loadScoreboard() {
    const tbody = document.getElementById("scoreboard-tbody");
    try {
        const res = await authFetch(`${API_BASE}/users/scoreboard`);
        if (!res.ok) throw new Error("Could not load leaderboard");
        const players = await res.json();
        
        if (players.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="empty-state-text">No players registered yet</td></tr>`;
            return;
        }
        
        tbody.innerHTML = players.map((player, idx) => {
            const rank = idx + 1;
            let rankClass = "rank-other";
            if (rank === 1) rankClass = "rank-1";
            else if (rank === 2) rankClass = "rank-2";
            else if (rank === 3) rankClass = "rank-3";
            
            return `
                <tr>
                    <td><span class="rank-badge ${rankClass}">${rank}</span></td>
                    <td>${escapeHTML(player.username)}</td>
                    <td><strong>${player.score}</strong></td>
                </tr>
            `;
        }).join("");
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="3" class="empty-state-text">Failed to load leaderboard</td></tr>`;
    }
}

async function loadPlayHistory() {
    const ul = document.getElementById("history-list-ul");
    try {
        const res = await authFetch(`${API_BASE}/users/history`);
        if (!res.ok) throw new Error("Could not load play history");
        const history = await res.json();
        
        if (history.length === 0) {
            ul.innerHTML = `<li class="empty-state-text">No stories played yet</li>`;
            return;
        }
        
        ul.innerHTML = history.map(item => {
            const date = new Date(item.played_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            const outcomeClass = item.outcome === "win" ? "outcome-win" : "outcome-loss";
            const outcomeIcon = item.outcome === "win" ? '<i class="fa-solid fa-trophy"></i>' : '<i class="fa-solid fa-circle-xmark"></i>';
            const outcomeText = item.outcome === "win" ? "Win" : "Loss";
            
            return `
                <li class="history-item">
                    <div class="history-details">
                        <span class="history-title">${escapeHTML(item.story_title)}</span>
                        <span class="history-time">${date}</span>
                    </div>
                    <span class="history-outcome ${outcomeClass}">
                        ${outcomeIcon} ${outcomeText}
                    </span>
                </li>
            `;
        }).join("");
    } catch (err) {
        console.error(err);
        ul.innerHTML = `<li class="empty-state-text">Failed to load play history</li>`;
    }
}

// Load Stories Grid
async function loadPastStories() {
    try {
        const storedIdsJson = localStorage.getItem("generated_story_ids");
        const storyIds = storedIdsJson ? JSON.parse(storedIdsJson) : [];
        
        if (storyIds.length === 0) {
            appState.stories = [];
            renderStoriesGrid();
            return;
        }
        
        // Show loading state in grid
        elements.pastStoriesGrid.innerHTML = `
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
        `;
        
        // Fetch all in parallel
        const fetchPromises = storyIds.map(id => 
            authFetch(`${API_BASE}/stories/${id}`)
                .then(res => {
                    if (!res.ok) throw new Error("Not found");
                    return res.json();
                })
        );
        
        const results = await Promise.allSettled(fetchPromises);
        const loadedStories = [];
        const validStoryIds = [];
        
        results.forEach((result, index) => {
            const originalId = storyIds[index];
            if (result.status === "fulfilled" && result.value) {
                const story = result.value;
                if (!Array.isArray(story.nodes)) {
                    story.nodes = [];
                }

                story.nodes = story.nodes.map(node => ({
                    ...node,
                    options: Array.isArray(node.options) ? node.options : []
                }));

                const storedThemes = JSON.parse(localStorage.getItem("story_themes") || "{}");
                
                let rootContentSnippet = "An interactive AI adventure.";
                if (story.nodes && Array.isArray(story.nodes) && story.nodes.length > 0) {
                    const sorted = [...story.nodes].sort((a, b) => a.id - b.id);
                    if (sorted[0] && sorted[0].content) {
                        rootContentSnippet = sorted[0].content.substring(0, 60) + "...";
                    }
                }
                
                story.theme = storedThemes[story.id] || rootContentSnippet;
                story.created_at = story.created_at || new Date().toISOString();
                
                loadedStories.push(story);
                validStoryIds.push(originalId);
            }
        });
        
        if (validStoryIds.length !== storyIds.length) {
            localStorage.setItem("generated_story_ids", JSON.stringify(validStoryIds));
        }
        
        appState.stories = loadedStories.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
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

async function loadAndPlayStory(storyId) {
    try {
        const response = await authFetch(`${API_BASE}/stories/${storyId}`);
        if (!response.ok) {
            throw new Error("Story not found");
        }

        const story = await response.json();
        const sanitizedNodes = {};
        let rootNodeId = null;
        let minId = Infinity;

        if (story.nodes && Array.isArray(story.nodes)) {
            story.nodes.forEach(node => {
                node.options = node.options || [];
                node.is_winning = node.is_winning_ending || false;
                node.is_losing = node.is_ending && !node.is_winning;

                node.options = node.options.map(option => ({
                    text: option.text,
                    target_node_id: option.target_node_id || option.next_node_id
                }));

                sanitizedNodes[node.id] = node;

                if (node.is_root) {
                    rootNodeId = node.id;
                }
                if (node.id < minId) {
                    minId = node.id;
                }
            });
        }

        if (!rootNodeId) {
            rootNodeId = minId;
        }

        story.nodes = sanitizedNodes;
        story.root_node_id = rootNodeId;

        const storedThemes = JSON.parse(localStorage.getItem("story_themes") || "{}");
        story.theme = storedThemes[storyId] || "AI Generated Adventure";

        playStory(story);
    } catch (error) {
        console.error("Error loading story details:", error);
        alert("Failed to load story detail. Check backend server.");
    }
}

// Submit Theme and levels to Queue
async function triggerStoryGeneration(theme, minLevels, maxLevels) {
    appState.currentTheme = theme;
    switchView("loader");
    resetLoaderSteps();
    updateLoaderText("Sending request to adventure queue...", "task");
    
    try {
        const response = await authFetch(`${API_BASE}/stories/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                theme,
                min_levels: minLevels,
                max_levels: maxLevels
            })
        });
        
        if (!response.ok) throw new Error("Failed to dispatch task");
        
        const task = await response.json();
        setStepCompleted("step-task");
        
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
            const response = await authFetch(`${API_BASE}/stories/tasks/${taskId}`);
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
                
                const storyId = task.result.id;
                
                const storedIdsJson = localStorage.getItem("generated_story_ids");
                const storyIds = storedIdsJson ? JSON.parse(storedIdsJson) : [];
                if (!storyIds.includes(storyId)) {
                    storyIds.push(storyId);
                    localStorage.setItem("generated_story_ids", JSON.stringify(storyIds));
                }
                
                const storedThemes = JSON.parse(localStorage.getItem("story_themes") || "{}");
                storedThemes[storyId] = appState.currentTheme || "AI Generated Story";
                localStorage.setItem("story_themes", JSON.stringify(storedThemes));
                
                setTimeout(() => loadAndPlayStory(storyId), 800);
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
    
    let nodeTitle = "Choose Your Path";
    if (Number(nodeId) === Number(appState.activeStory.root_node_id)) {
        nodeTitle = "The Journey Begins";
    } else if (node.is_winning) {
        nodeTitle = "Victory!";
    } else if (node.is_losing) {
        nodeTitle = "Defeat!";
    }
    
    elements.lblNodeTitle.textContent = nodeTitle;
    elements.lblNodeContent.textContent = node.content;
    
    elements.cardNarrative.classList.remove("win-state", "loss-state");
    elements.bannerWin.style.display = "none";
    elements.bannerLoss.style.display = "none";
    elements.panelEndActions.style.display = "none";
    elements.lblOptionsHeader.style.display = "block";
    elements.choicesList.style.display = "flex";
    
    if (node.is_winning === true) {
        elements.cardNarrative.classList.add("win-state");
        elements.bannerWin.style.display = "flex";
        elements.lblOptionsHeader.style.display = "none";
        elements.choicesList.style.display = "none";
        elements.panelEndActions.style.display = "flex";
        recordPlayOutcome("win");
    } else if (node.is_losing === true) {
        elements.cardNarrative.classList.add("loss-state");
        elements.bannerLoss.style.display = "flex";
        elements.lblOptionsHeader.style.display = "none";
        elements.choicesList.style.display = "none";
        elements.panelEndActions.style.display = "flex";
        recordPlayOutcome("loss");
    } else {
        elements.choicesList.innerHTML = (node.options || []).map((option, idx) => {
            return `
                <button class="btn-choice" onclick="renderStoryNode('${option.target_node_id}')">
                    <span>${escapeHTML(option.text)}</span>
                    <i class="fa-solid fa-chevron-right"></i>
                </button>
            `;
        }).join("");
        
        if (node.options.length === 0) {
            elements.choicesList.innerHTML = `
                <div style="color: var(--color-text-muted); font-size: 0.95rem; margin-bottom: 1rem;">
                    This route seems to have reached a quiet dead end.
                </div>
            `;
            elements.panelEndActions.style.display = "flex";
        }
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Record the win or loss outcome to the backend
async function recordPlayOutcome(outcome) {
    if (!appState.activeStory) return;
    try {
        const res = await authFetch(`${API_BASE}/stories/${appState.activeStory.id}/play`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ outcome })
        });
        if (res.ok) {
            const data = await res.json();
            if (appState.currentUser) {
                appState.currentUser.score = data.new_score;
                const scoreElem = document.getElementById("stat-score");
                if (scoreElem) {
                    scoreElem.textContent = data.new_score;
                }
            }
        }
    } catch (err) {
        console.error("Failed to record play outcome:", err);
    }
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
