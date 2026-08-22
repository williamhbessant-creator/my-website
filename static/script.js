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
let aiUsesElement = null;

function updateUsesRemaining(remaining) {
    if (typeof remaining !== "number") return;
    aiUsesRemaining = Math.max(0, remaining);

    if (!aiUsesElement) aiUsesElement = document.getElementById("aiUsesRemaining");
    if (!aiUsesElement) {
        aiUsesElement = document.createElement("div");
        aiUsesElement.id = "aiUsesRemaining";
        aiUsesElement.className = "ai-uses-remaining";
        const inputArea = document.getElementById("aiForm");
        if (inputArea) inputArea.appendChild(aiUsesElement);
        else aiSidebar.appendChild(aiUsesElement);
    }

    aiUsesElement.textContent = `${aiUsesRemaining} AI uses remaining`;

    if (aiUsesRemaining <= 0) {
        aiInput.disabled = true;
        aiSendButton.disabled = true;
        aiInput.placeholder = "No AI uses remaining";
    } else if (!aiSendButton.dataset.loading) {
        aiInput.disabled = false;
        aiSendButton.disabled = false;
        aiInput.placeholder = "Ask the AI...";
    }
}

async function loadAIUses() {
    try {
        const response = await fetch("/api/ai/usage", {
            method: "GET",
            headers: { "Accept": "application/json" }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load AI usage.");
        updateUsesRemaining(data.uses_remaining);
    } catch (error) {
        console.error("AI usage error:", error);
        updateUsesRemaining(5);
    }
}

function openAI() {
    aiSidebar.classList.add("open");
    aiOverlay.classList.add("open");
    aiSidebar.setAttribute("aria-hidden", "false");
    aiOverlay.setAttribute("aria-hidden", "false");
    loadAIUses();
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
document.addEventListener("keydown", event => {
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

function setAILoading(loading) {
    aiSendButton.dataset.loading = loading ? "true" : "false";
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
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text, history: aiConversation.slice(-12) })
        });
        const data = await response.json();
        loadingMessage.remove();
        if (typeof data.uses_remaining === "number") updateUsesRemaining(data.uses_remaining);
        if (!response.ok) throw new Error(data.error || "AI request failed.");
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

aiForm.addEventListener("submit", event => {
    event.preventDefault();
    sendAIMessage();
});

aiInput.addEventListener("keydown", event => {
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

let activeMessageMenu = null;

function closeMessageMenu() {
    if (activeMessageMenu) {
        activeMessageMenu.remove();
        activeMessageMenu = null;
    }
    document.querySelectorAll(".message.message-selected").forEach(el => el.classList.remove("message-selected"));
}

function showMessageMenu(div, id, protectedMessage) {
    closeMessageMenu();
    div.classList.add("message-selected");

    const menu = document.createElement("div");
    menu.className = "message-actions";

    const protectButton = document.createElement("button");
    protectButton.type = "button";
    protectButton.className = "message-action-protect";
    protectButton.textContent = protectedMessage ? "Unprotect" : "Protect from deletion";
    protectButton.addEventListener("click", event => {
        event.stopPropagation();
        socket.emit("toggle_message_protection", { id });
        closeMessageMenu();
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "message-action-delete";
    deleteButton.textContent = protectedMessage ? "Protected" : "Delete message";
    deleteButton.disabled = protectedMessage;
    deleteButton.addEventListener("click", event => {
        event.stopPropagation();
        if (!protectedMessage && confirm("Delete this message?")) {
            socket.emit("delete_message", { id });
        }
        closeMessageMenu();
    });

    menu.appendChild(protectButton);
    menu.appendChild(deleteButton);
    div.appendChild(menu);
    activeMessageMenu = menu;
}

function addMessage(id, user, text, time, protectedMessage = false) {
    const div = document.createElement("div");
    div.className = user === "[SERVER]" ? "message server-message" : "message";
    div.dataset.messageId = id;
    div.dataset.protected = protectedMessage ? "true" : "false";

    div.innerHTML =
        `<span class="time">[${escapeHtml(time)}]</span> ` +
        `<span class="user">${escapeHtml(user)}</span>: ` +
        `<span class="text">${escapeHtml(text)}</span>`;

    if (protectedMessage) {
        const badge = document.createElement("span");
        badge.className = "protected-badge";
        badge.textContent = " Protected";
        div.appendChild(badge);
    }

    div.addEventListener("click", event => {
        if (event.target.closest(".message-actions")) return;
        showMessageMenu(div, id, div.dataset.protected === "true");
    });

    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function updateMessageProtection(id, protectedMessage) {
    const div = document.querySelector(`.message[data-message-id="${CSS.escape(String(id))}"]`);
    if (!div) return;

    div.dataset.protected = protectedMessage ? "true" : "false";
    div.querySelector(".protected-badge")?.remove();

    if (protectedMessage) {
        const badge = document.createElement("span");
        badge.className = "protected-badge";
        badge.textContent = " Protected";
        div.appendChild(badge);
    }
}

socket.on("connect", () => {
    console.log("Connected to chat server");
    socket.emit("request_history");
});

socket.on("disconnect", () => console.log("Disconnected from chat server"));
socket.on("connect_error", error => console.error("Socket.IO connection error:", error));

socket.on("chat_history", history => {
    closeMessageMenu();
    chatBox.innerHTML = "";
    history.forEach(msg => addMessage(msg[0], msg[1], msg[2], msg[3], msg[4]));
});

socket.on("new_message", data => addMessage(data.id, data.username, data.message, data.timestamp, data.protected));

socket.on("message_deleted", data => {
    closeMessageMenu();
    const div = document.querySelector(`.message[data-message-id="${CSS.escape(String(data.id))}"]`);
    if (div) div.remove();
});

socket.on("message_protection_changed", data => {
    updateMessageProtection(data.id, data.protected);
});

socket.on("message_action_error", data => {
    alert(data.error || "The message action could not be completed.");
});

socket.on("history_cleared", () => {
    closeMessageMenu();
    document.querySelectorAll(".message:not([data-protected='true'])").forEach(div => div.remove());
});

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

message.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        event.preventDefault();
        sendMessage();
    }
});

clearButton.addEventListener("click", () => {
    if (confirm("Clear the chat? Protected messages will stay.")) {
        socket.emit("clear_history");
    }
});

document.addEventListener("click", event => {
    if (!event.target.closest(".message")) closeMessageMenu();
});
