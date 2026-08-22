const socket = io();

const chatBox = document.getElementById("chat-box");
const username = document.getElementById("username");
const message = document.getElementById("message");
const sendButton = document.getElementById("sendButton");
const clearButton = document.getElementById("clearButton");
const themeButton = document.getElementById("themeButton");
const themeStylesheet = document.getElementById("themeStylesheet");

// ================================
// THEME
// ================================
function applyTheme(theme) {
    if (theme === "light") {
        themeStylesheet.href = "/static/lightstyle.css";
    } else {
        themeStylesheet.href = "/static/darkstyle.css";
        theme = "dark";
    }
    localStorage.setItem("chatTheme", theme);
}

function toggleTheme() {
    const currentTheme = localStorage.getItem("chatTheme") || "dark";
    applyTheme(currentTheme === "dark" ? "light" : "dark");
}

themeButton.addEventListener("click", toggleTheme);
applyTheme(localStorage.getItem("chatTheme") || "dark");

// ================================
// AI ASSISTANT SIDEBAR
// ================================
const aiOpenButton = document.getElementById("aiOpenButton");
const aiCloseButton = document.getElementById("aiCloseButton");
const aiSidebar = document.getElementById("aiSidebar");
const aiOverlay = document.getElementById("aiOverlay");
const aiForm = document.getElementById("aiForm");
const aiInput = document.getElementById("aiInput");
const aiMessages = document.getElementById("aiMessages");
const aiSendButton = document.getElementById("aiSendButton");

const aiConversation = [];
let aiUsesRemaining = null;

function openAI() {
    aiSidebar.classList.add("open");
    aiOverlay.classList.add("open");
    aiSidebar.setAttribute("aria-hidden", "false");
    aiOverlay.setAttribute("aria-hidden", "false");
    setTimeout(() => aiInput.focus(), 250);
}

function closeAI() {
    aiSidebar.classList.remove("open");
    aiOverlay.classList.remove("open");
    aiSidebar.setAttribute("aria-hidden", "true");
    aiOverlay.setAttribute("aria-hidden", "true");
}

aiOpenButton.addEventListener("click", openAI);
aiCloseButton.addEventListener("click", closeAI);
aiOverlay.addEventListener("click", closeAI);

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAI();
});

function addAIMessage(text, type) {
    const div = document.createElement("div");
    div.className = `ai-message ai-message-${type}`;

    const name = document.createElement("div");
    name.className = "ai-message-name";
    name.textContent = type === "user" ? "You" : "AI Assistant";

    const body = document.createElement("div");
    body.textContent = text;

    div.appendChild(name);
    div.appendChild(body);
    aiMessages.appendChild(div);
    aiMessages.scrollTop = aiMessages.scrollHeight;

    return div;
}

function updateUsesRemaining(remaining) {
    if (typeof remaining !== "number") return;

    aiUsesRemaining = remaining;

    let usesElement = document.getElementById("aiUsesRemaining");
    if (!usesElement) {
        usesElement = document.createElement("div");
        usesElement.id = "aiUsesRemaining";
        usesElement.className = "ai-uses-remaining";
        aiMessages.parentElement.insertBefore(usesElement, aiMessages);
    }

    usesElement.textContent = `${remaining} AI uses remaining`;

    if (remaining <= 0) {
        aiInput.disabled = true;
        aiSendButton.disabled = true;
        aiInput.placeholder = "No AI uses remaining";
    }
}

function setAILoading(loading) {
    aiSendButton.disabled = loading || aiUsesRemaining === 0;
    aiInput.disabled = loading || aiUsesRemaining === 0;
    aiSendButton.textContent = loading ? "..." : "Send";
}

async function sendAIMessage() {
    const text = aiInput.value.trim();
    if (!text || aiSendButton.disabled) return;

    addAIMessage(text, "user");
    aiConversation.push({ role: "user", content: text });
    aiInput.value = "";
    setAILoading(true);

    const loadingMessage = addAIMessage("Thinking...", "assistant");

    try {
        const response = await fetch("/api/ai", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: text,
                history: aiConversation.slice(-12)
            })
        });

        const data = await response.json();
        loadingMessage.remove();

        if (typeof data.uses_remaining === "number") {
            updateUsesRemaining(data.uses_remaining);
        }

        if (!response.ok) {
            throw new Error(data.error || "AI request failed.");
        }

        const reply = data.response || "The AI returned an empty response.";
        addAIMessage(reply, "assistant");
        aiConversation.push({ role: "assistant", content: reply });

    } catch (error) {
        loadingMessage.remove();
        addAIMessage(error.message, "assistant");
        console.error("AI request error:", error);
    } finally {
        setAILoading(false);
        if (aiUsesRemaining !== 0) aiInput.focus();
    }
}

aiForm.addEventListener("submit", (event) => {
    event.preventDefault();
    sendAIMessage();
});

aiInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        aiForm.requestSubmit();
    }
});

// ================================
// CHAT MESSAGES
// ================================
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function addMessage(user, text, time) {
    const div = document.createElement("div");
    div.className = user === "[SERVER]" ? "message server-message" : "message";
    div.innerHTML =
        `<span class="time">[${escapeHtml(time)}]</span> ` +
        `<span class="user">${escapeHtml(user)}</span>: ` +
        `<span class="text">${escapeHtml(text)}</span>`;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

socket.on("connect", () => {
    console.log("Connected to chat server");
    socket.emit("request_history");
});

socket.on("disconnect", () => console.log("Disconnected from chat server"));
socket.on("connect_error", (error) => console.error("Socket.IO connection error:", error));

socket.on("chat_history", (history) => {
    chatBox.innerHTML = "";
    history.forEach(msg => addMessage(msg[0], msg[1], msg[2]));
});

socket.on("new_message", (data) => addMessage(data.username, data.message, data.timestamp));
socket.on("history_cleared", () => chatBox.innerHTML = "");

function sendMessage() {
    const user = username.value.trim();
    const text = message.value.trim();

    if (user === "") {
        alert("Please enter a username.");
        username.focus();
        return;
    }
    if (text === "") {
        message.focus();
        return;
    }

    socket.emit("send_message", { username: user, message: text });
    message.value = "";
    message.focus();
}

sendButton.addEventListener("click", sendMessage);

message.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        sendMessage();
    }
});

clearButton.addEventListener("click", () => {
    if (confirm("Clear the entire chat history?")) {
        socket.emit("clear_history");
    }
});
