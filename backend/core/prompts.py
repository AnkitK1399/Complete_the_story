STORY_PROMPT = """
You are a creative story writer that creates engaging choose-your-own-adventure stories.

Generate a complete branching story based on the following theme:

Theme: {theme}

Requirements:
1. Create a compelling story title.
2. Create a starting situation (root node) with 2-3 choices.
3. Each choice should lead to another story node.
4. Some paths should end in failure/loss endings.
5. At least one path should end in a winning ending.
6. The story should be {min_levels}-{max_levels} levels deep including the root node.
7. Ending nodes must not contain options.
8. Non-ending nodes must contain 2-3 options.

Return ONLY valid JSON.

Use this exact JSON structure:

{{
    "title": "Story Title",
    "rootNode": {{
        "content": "The starting situation of the story",
        "is_ending": false,
        "is_winning_ending": false,
        "options": [
            {{
                "text": "Option 1 text",
                "next_node": {{
                    "content": "What happens after choosing option 1",
                    "is_ending": false,
                    "is_winning_ending": false,
                    "options": [
                        {{
                            "text": "Another choice",
                            "next_node": {{
                                "content": "Ending or continuation",
                                "is_ending": true,
                                "is_winning_ending": false
                            }}
                        }}
                    ]
                }}
            }},
            {{
                "text": "Option 2 text",
                "next_node": {{
                    "content": "Another path in the story",
                    "is_ending": false,
                    "is_winning_ending": false,
                    "options": []
                }}
            }}
        ]
    }}
}}

Rules:
- Return ONLY JSON.
- Do NOT include markdown.
- Do NOT include explanations.
- Do NOT omit required fields.
- Use lowercase true/false values.
"""