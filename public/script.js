let sessionId = localStorage.getItem("sessionId") || null;

// 👇 Add your backend API URL here
const API_URL = "https://smarty-767i.onrender.com/";

async function sendMessage() {
  const input = document.getElementById("input");
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, "user");
  input.value = "";

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: text, sessionId }),
  });

  const data = await res.json();
  sessionId = data.sessionId;
  localStorage.setItem("sessionId", sessionId);

  addMessage(data.reply, "bot");
}

function addMessage(text, type) {
  const msgBox = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = "msg " + type;
  div.innerText = text;
  msgBox.appendChild(div);
  msgBox.scrollTop = msgBox.scrollHeight;
}

document.getElementById("sendBtn").addEventListener("click", sendMessage);
document.getElementById("input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});


