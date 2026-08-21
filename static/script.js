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
}

aiForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = aiInput.value.trim();
    if (!text) return;

    addAIMessage(text, "user");
    aiInput.value = "";

    // AI backend can be connected here later.
    setTimeout(() => {
        addAIMessage("The AI assistant is ready, but its AI backend has not been connected yet.", "assistant");
    }, 300);
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

// ================================
// LOAD CHAT HISTORY
// ================================
socket.on("connect", () => {
    console.log("Connected to chat server");
    socket.emit("request_history");
});

socket.on("disconnect", () => console.log("Disconnected from chat server"));

socket.on("connect_error", (error) => {
    console.error("Socket.IO connection error:", error);
});

socket.on("chat_history", (history) => {
    chatBox.innerHTML = "";
    history.forEach(msg => addMessage(msg[0], msg[1], msg[2]));
});

socket.on("new_message", (data) => {
    addMessage(data.username, data.message, data.timestamp);
});

socket.on("history_cleared", () => {
    chatBox.innerHTML = "";
});

// ================================
// SEND MESSAGE
// ================================
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

// ================================
// CLEAR CHAT
// ================================
clearButton.addEventListener("click", () => {
    if (confirm("Clear the entire chat history?")) {
        socket.emit("clear_history");
    }
});
