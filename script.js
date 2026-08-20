const socket = io();

const chatBox = document.getElementById("chat-box");
const username = document.getElementById("username");
const message = document.getElementById("message");
const sendButton = document.getElementById("sendButton");
const clearButton = document.getElementById("clearButton");
let themeButton = document.getElementById("themeButton");
const originalTitle = document.title;
const themeLink = document.getElementById("themeStylesheet") || document.querySelector('link[rel="stylesheet"][href*="style"]');
const themeIconSrc = "/static/icons8-light-48.png";

function createThemeButton() {
    const button = document.createElement("button");
    button.id = "themeButton";
    button.title = "Toggle theme";

    const img = document.createElement("img");
    img.src = themeIconSrc;
    img.alt = "Toggle theme";
    img.style.width = "20px";
    img.style.height = "20px";
    img.style.verticalAlign = "middle";
    img.style.marginRight = "6px";

    button.appendChild(img);
    button.appendChild(document.createTextNode("Theme"));
    button.addEventListener("click", toggleTheme);
    return button;
}

function updateThemeIcon(mode) {
    if (!themeButton) return;
    const icon = themeButton.querySelector("img");
    if (!icon) return;
    icon.src = themeIconSrc;
}

function applyTheme(mode) {
    const normalized = mode === "dark" ? "dark" : "light";
    if (themeLink) {
        themeLink.href = `/static/${normalized}style.css`;
    }
    localStorage.setItem("chatTheme", normalized);
    updateThemeIcon(normalized);
}

function toggleTheme() {
    const current = localStorage.getItem("chatTheme") || "light";
    applyTheme(current === "light" ? "dark" : "light");
}

if (!themeButton) {
    themeButton = createThemeButton();
    if (clearButton && clearButton.parentNode) {
        clearButton.parentNode.insertBefore(themeButton, clearButton);
    } else {
        const controls = document.querySelector(".controls");
        if (controls) controls.appendChild(themeButton);
    }
}

const savedTheme = localStorage.getItem("chatTheme") || "dark";
applyTheme(savedTheme);

if (themeButton) {
    themeButton.addEventListener("click", toggleTheme);
}

function addMessage(user, text, time) {

    const div = document.createElement("div");

    if (user === "[SERVER]") {
        div.className = "message server-message";
    } else {
        div.className = "message";
    }
    

    div.innerHTML =
        `<span class="time">[${time}]</span> ` +
        `<span class="user">${escapeHtml(user)}</span>: ` +
        `<span class="text">${escapeHtml(text)}</span>`;

    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function requestNotificationPermission() {
    if (!("Notification" in window)) return;

    if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
    }
}

function flashTitle(text) {
    if (document.title !== text) {
        document.title = text;
    }
}

function restoreTitle() {
    document.title = originalTitle;
}

function playMessageSound() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1320, audioContext.currentTime + 0.12);

    gainNode.gain.setValueAtTime(0.04, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.2);
}

function showNotification(user, text) {
    const shouldNotify = document.visibilityState !== "visible" || !document.hasFocus();

    if (!shouldNotify) return;

    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(`New message from ${user}`, {
            body: text,
            tag: "public-chat-message"
        });
        playMessageSound();
        return;
    }

    flashTitle(`New message from ${user}`);
    playMessageSound();
}

window.addEventListener("focus", restoreTitle);
window.addEventListener("click", requestNotificationPermission, { once: true });
message.addEventListener("focus", requestNotificationPermission);

socket.emit("request_history");

socket.on("chat_history", (history) => {
    chatBox.innerHTML = "";

    history.forEach(msg => {
        addMessage(msg[0], msg[1], msg[2]);
    });
});

socket.on("new_message", (data) => {
    addMessage(
        data.username,
        data.message,
        data.timestamp
    );

    const currentUser = username.value.trim();
    if (data.username !== currentUser) {
        showNotification(data.username, data.message);
    }
});

socket.on("history_cleared", () => {
    chatBox.innerHTML = "";
});

function sendMessage() {

    const user = username.value.trim();
    const text = message.value.trim();

    if (user === "") {
        alert("Please enter a username.");
        return;
    }

    if (text === "") return;

    requestNotificationPermission();

    socket.emit("send_message", {
        username: user,
        message: text
    });

    message.value = "";
    message.focus();
}

sendButton.onclick = sendMessage;

message.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        sendMessage();
    }
});

clearButton.onclick = () => {

    if (confirm("Clear the entire chat history?")) {
        socket.emit("clear_history");
    }

};