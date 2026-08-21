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

    const currentTheme =
        localStorage.getItem("chatTheme") || "dark";

    if (currentTheme === "dark") {
        applyTheme("light");
    } else {
        applyTheme("dark");
    }
}


themeButton.addEventListener("click", toggleTheme);


// Load saved theme
applyTheme(
    localStorage.getItem("chatTheme") || "dark"
);


// ================================
// MESSAGES
// ================================

function escapeHtml(text) {

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}


function addMessage(user, text, time) {

    const div = document.createElement("div");

    if (user === "[SERVER]") {
        div.className = "message server-message";
    } else {
        div.className = "message";
    }

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


socket.on("disconnect", () => {

    console.log("Disconnected from chat server");

});


socket.on("connect_error", (error) => {

    console.error(
        "Socket.IO connection error:",
        error
    );

});


socket.on("chat_history", (history) => {

    chatBox.innerHTML = "";

    history.forEach(msg => {

        addMessage(
            msg[0],
            msg[1],
            msg[2]
        );

    });

});


socket.on("new_message", (data) => {

    addMessage(
        data.username,
        data.message,
        data.timestamp
    );

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

    socket.emit("send_message", {

        username: user,

        message: text

    });

    message.value = "";

    message.focus();
}


sendButton.addEventListener(
    "click",
    sendMessage
);


message.addEventListener(
    "keydown",
    (event) => {

        if (event.key === "Enter") {

            event.preventDefault();

            sendMessage();

        }

    }
);


// ================================
// CLEAR CHAT
// ================================

clearButton.addEventListener(
    "click",
    () => {

        if (
            confirm(
                "Clear the entire chat history?"
            )
        ) {

            socket.emit(
                "clear_history"
            );

        }

    }
);
