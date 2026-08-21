from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
import os
from datetime import datetime
from supabase import create_client
from openai import OpenAI


SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_PUBLISHABLE_KEY"]
AI_KEY = os.environ.get("AI_KEY")

supabase = create_client(
    SUPABASE_URL,
    SUPABASE_KEY
)

# -----------------------------
# Flask Setup
# -----------------------------
app = Flask(__name__)

app.config["SECRET_KEY"] = os.environ.get(
    "FLASK_SECRET_KEY",
    "development-secret"
)

socketio = SocketIO(
    app,
    cors_allowed_origins="*"
)

# Create the OpenAI client only when the server has the secret.
# The secret never gets sent to the browser.
openai_client = OpenAI(api_key=AI_KEY) if AI_KEY else None

# -----------------------------
# Home Page
# -----------------------------
@app.route("/")
def index():
    return render_template("index.html")

# -----------------------------
# AI Assistant
# -----------------------------
@app.post("/api/ai")
def ai_assistant():
    if openai_client is None:
        return jsonify({"error": "AI_KEY is not configured on the server."}), 500

    data = request.get_json(silent=True) or {}
    message = str(data.get("message", "")).strip()
    history = data.get("history", [])

    if not message:
        return jsonify({"error": "Please enter a message."}), 400

    if len(message) > 2000:
        return jsonify({"error": "Message is too long."}), 400

    # Keep only recent, valid conversation messages and limit their size.
    conversation = []
    if isinstance(history, list):
        for item in history[-12:]:
            if not isinstance(item, dict):
                continue
            role = item.get("role")
            text = str(item.get("content", "")).strip()
            if role in ("user", "assistant") and text:
                conversation.append({"role": role, "content": text[:4000]})

    conversation.append({"role": "user", "content": message})

    try:
        response = openai_client.responses.create(
            model="gpt-4.1 mini
            instructions=(
                "You are the AI assistant inside Woocorp Public Chat. "
                "Be helpful, concise, friendly, and clear."
            ),
            input=conversation,
        )

        return jsonify({"response": response.output_text})

    except Exception as error:
        print("AI request failed:", repr(error))
        return jsonify({"error": "The AI assistant could not get a response."}), 502

# -----------------------------
# Send Chat History
# -----------------------------
@socketio.on("request_history")
def send_history():

    response = (
        supabase
        .table("messageport5555")
        .select("username, message, timestamp")
        .order("id")
        .limit(500)
        .execute()
    )

    rows = [
        (
            row["username"],
            row["message"],
            row["timestamp"]
        )
        for row in response.data
    ]

    emit("chat_history", rows)

# -----------------------------
# Receive Message
# -----------------------------
@socketio.on("send_message")
def handle_message(data):

    username = data["username"]
    message = data["message"]

    timestamp = datetime.now().strftime("%H:%M:%S")
    supabase.table("messageport5555").insert({
        "username": username,
        "message": message,
        "timestamp": timestamp
    }).execute()

    emit(
        "new_message",
        {
            "username": username,
            "message": message,
            "timestamp": timestamp
        },
        broadcast=True
    )

# -----------------------------
# Clear History
# -----------------------------
@socketio.on("clear_history")
def clear_history():

    supabase.table("messageport5555") \
        .delete() \
        .neq("id", 0) \
        .execute()

    emit("history_cleared", broadcast=True)

# -----------------------------
# Start Server
# -----------------------------
if __name__ == "__main__":

    print("=" * 45)
    print(" Public Chat Server")
    print("=" * 45)
    print("Port: 5555")
    print("Database:", SUPABASE_URL)
    print("AI:", "enabled" if AI_KEY else "disabled - AI_KEY missing")
    print("=" * 45)

    socketio.run(
        app,
        host="0.0.0.0",
        port=5555
    )
