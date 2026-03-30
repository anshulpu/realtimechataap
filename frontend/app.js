const DEFAULT_BACKEND_PORT = "4000";
const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const backendOrigin = isLocalhost && window.location.port !== DEFAULT_BACKEND_PORT
  ? `${window.location.protocol}//${window.location.hostname}:${DEFAULT_BACKEND_PORT}`
  : "https://realtimechataap-zpvo.onrender.com";
const API_BASE = `${backendOrigin}/api`;
const SOCKET_URL = backendOrigin;

const authSection = document.getElementById("authSection");
const chatSection = document.getElementById("chatSection");
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const authMessage = document.getElementById("authMessage");
const authCard = document.querySelector(".auth-card");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const passwordToggles = document.querySelectorAll(".password-toggle");

const usersList = document.getElementById("usersList");
const userSearchInput = document.getElementById("userSearchInput");
const roomsList = document.getElementById("roomsList");
const messagesEl = document.getElementById("messages");
const messagesLoading = document.getElementById("messagesLoading");
const messagesLoadingText = document.getElementById("messagesLoadingText");
const emptyState = document.getElementById("emptyState");
const chatTitle = document.getElementById("chatTitle");
const chatPresenceText = document.getElementById("chatPresenceText");
const chatPresenceDot = document.getElementById("chatPresenceDot");
const chatAvatar = document.getElementById("chatAvatar");
const chatOnlineBadge = document.getElementById("chatOnlineBadge");
const chatAvatarWrap = document.querySelector(".avatar-wrap");
const typingStatus = document.getElementById("typingStatus");
const voiceCallBtn = document.getElementById("voiceCallBtn");
const videoCallBtn = document.getElementById("videoCallBtn");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const fileInput = document.getElementById("fileInput");
const voiceBtn = document.getElementById("voiceBtn");
const locationBtn = document.getElementById("locationBtn");
const voiceTimer = document.getElementById("voiceTimer");
const attachmentPreview = document.getElementById("attachmentPreview");
const createRoomBtn = document.getElementById("createRoomBtn");
const roomNameInput = document.getElementById("roomNameInput");
const meName = document.getElementById("meName");
const meAvatar = document.getElementById("meAvatar");
const emojiBtn = document.getElementById("emojiBtn");
const emojiTray = document.getElementById("emojiTray");
const profilePanelTrigger = document.getElementById("profilePanelTrigger");
const profilePanel = document.getElementById("profilePanel");
const profilePanelOverlay = document.getElementById("profilePanelOverlay");
const profilePanelClose = document.getElementById("profilePanelClose");
const profileAvatar = document.getElementById("profileAvatar");
const profileName = document.getElementById("profileName");
const profilePresence = document.getElementById("profilePresence");
const profilePhone = document.getElementById("profilePhone");
const profileEmail = document.getElementById("profileEmail");
const profileAbout = document.getElementById("profileAbout");
const profileStats = document.getElementById("profileStats");
const profileMediaGrid = document.getElementById("profileMediaGrid");
const toggleFavouriteBtn = document.getElementById("toggleFavouriteBtn");
const toggleBlockBtn = document.getElementById("toggleBlockBtn");
const clearChatBtn = document.getElementById("clearChatBtn");
const deleteConversationBtn = document.getElementById("deleteConversationBtn");
const mediaPreviewModal = document.getElementById("mediaPreviewModal");
const mediaPreviewImage = document.getElementById("mediaPreviewImage");
const mediaPreviewClose = document.getElementById("mediaPreviewClose");
const callModal = document.getElementById("callModal");
const callTitle = document.getElementById("callTitle");
const callStatus = document.getElementById("callStatus");
const callAvatar = document.getElementById("callAvatar");
const callPeerName = document.getElementById("callPeerName");
const callVideos = document.getElementById("callVideos");
const remoteVideo = document.getElementById("remoteVideo");
const localVideo = document.getElementById("localVideo");
const acceptCallBtn = document.getElementById("acceptCallBtn");
const rejectCallBtn = document.getElementById("rejectCallBtn");
const muteCallBtn = document.getElementById("muteCallBtn");
const toggleCamBtn = document.getElementById("toggleCamBtn");
const endCallBtn = document.getElementById("endCallBtn");
const callBadge = document.getElementById("callBadge");
const callsList = document.getElementById("callsList");
const sidebar = document.querySelector(".sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const callToast = document.getElementById("callToast");
const callToastAvatar = document.getElementById("callToastAvatar");
const callToastTitle = document.getElementById("callToastTitle");
const callToastText = document.getElementById("callToastText");
const callToastAccept = document.getElementById("callToastAccept");
const callToastReject = document.getElementById("callToastReject");
const callToastCallback = document.getElementById("callToastCallback");

let token = "";
let me = null;
let socket = null;
let selected = null;
let users = [];
let rooms = [];
let typingTimer;
let selectedAttachment = null;
let isFetchingMessages = false;
let isLoadingOlder = false;
let shouldStickToBottom = true;
let activeChatLoadSeq = 0;

const MESSAGES_PAGE_SIZE = 20;
const messageCacheByChat = new Map();
const renderedCountByChat = new Map();

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_UPLOADS = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/wav",
  "audio/mp4"
]);

let mediaRecorder = null;
let mediaStream = null;
let recorderChunks = [];
let isRecording = false;
let recordingStartedAt = 0;
let recordingTimerId = null;

let locationWatchId = null;
let isLocationSharing = false;
let lastLocationSentAt = 0;
let lastLocationCoords = null;
let activeProfileData = null;
const unreadByChat = new Map();
const baseDocumentTitle = document.title || "Realtime Chat";
let peerConnection = null;
let localCallStream = null;
let currentCallPeerId = "";
let currentCallType = "voice";
let currentCallId = "";
let pendingIncomingOffer = null;
let isOutgoingCall = false;
let isCallMuted = false;
let isCameraEnabled = true;
let callTimerId = null;
let callConnectedAt = 0;
let callRingtoneId = null;
let callAudioCtx = null;
let callHistory = [];
let missedCallCount = 0;
let callToastTimerId = null;

const LOCATION_MESSAGE_PREFIX = "__live_location__";
const LOCATION_SEND_INTERVAL_MS = 12000;
const LOCATION_MIN_MOVE_METERS = 15;
const rtcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const initials = (name) => String(name || "?").slice(0, 2).toUpperCase();
const timeText = (date) => new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function getReceiptForStatus(status) {
  if (status === "read") return "✓✓";
  if (status === "delivered") return "✓✓";
  return "✓";
}

function getReceiptClass(status) {
  if (status === "read") return "read-seen";
  if (status === "delivered") return "read-delivered";
  return "read-sent";
}

function lastSeenText(user) {
  if (!user) return "No chat selected";
  if (user.isOnline) return "Online";
  if (!user.lastSeen) return "Offline";

  const last = new Date(user.lastSeen).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - last);
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Last seen just now";
  if (diffMin < 60) return `Last seen ${diffMin} min${diffMin === 1 ? "" : "s"} ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Last seen ${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

  const text = new Date(user.lastSeen).toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
  return `Last seen ${text}`;
}

function setEmptyStateVisibility(isVisible) {
  emptyState.classList.toggle("hidden", !isVisible);
  messagesEl.classList.toggle("hidden", isVisible);
}

function setMessagesLoading(loading, text = "Loading messages...") {
  messagesLoading.classList.toggle("hidden", !loading);
  messagesLoadingText.textContent = text;
}

function selectedKey() {
  if (!selected) return "";
  return `${selected.type}:${selected.id}`;
}

function privateChatKey(userId) {
  return `private:${String(userId || "")}`;
}

function roomChatKey(roomId) {
  return `room:${String(roomId || "")}`;
}

function chatKeyFromIncomingMessage(message) {
  if (message?.roomId) return roomChatKey(message.roomId);

  const senderId = String(message?.senderId || "");
  const receiverId = String(message?.receiverId || "");
  const myId = String(me?.id || "");
  if (!senderId || !receiverId || !myId) return "";

  return privateChatKey(senderId === myId ? receiverId : senderId);
}

function totalUnreadCount() {
  return Array.from(unreadByChat.values()).reduce((sum, count) => sum + Number(count || 0), 0);
}

function refreshDocumentTitle() {
  const unread = totalUnreadCount();
  document.title = unread > 0 ? `(${unread}) ${baseDocumentTitle}` : baseDocumentTitle;
}

function clearUnreadForSelectedChat() {
  const key = selectedKey();
  if (!key) return;
  if (unreadByChat.delete(key)) {
    refreshDocumentTitle();
  }
}

function incrementUnread(chatKey) {
  if (!chatKey) return;
  unreadByChat.set(chatKey, (unreadByChat.get(chatKey) || 0) + 1);
  refreshDocumentTitle();
}

function requestNotificationPermissionFromGesture() {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "default") return;

  const ask = () => {
    Notification.requestPermission().catch(() => {
      // ignore permission prompt failures
    });
  };

  document.addEventListener("click", ask, { once: true });
}

function notificationBodyForMessage(message) {
  if (parseLocationMessage(message?.message)) return "Shared a live location";

  const mimeType = String(message?.attachment?.mimeType || "");
  if (mimeType.startsWith("image/")) return "Sent an image";
  if (mimeType.startsWith("audio/")) return "Sent an audio message";
  if (mimeType) return "Sent an attachment";

  return String(message?.message || "New message").slice(0, 120);
}

function showBrowserNotification(message) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (String(message?.senderId) === String(me?.id)) return;

  const senderName = users.find((user) => String(user.id) === String(message.senderId))?.username || "New message";
  const roomName = rooms.find((room) => String(room.id) === String(message.roomId))?.name || "Room";
  const title = message?.roomId ? `# ${roomName}` : senderName;

  const notification = new Notification(title, {
    body: notificationBodyForMessage(message),
    tag: chatKeyFromIncomingMessage(message) || undefined
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };
}

function isPrivateChatSelected() {
  return Boolean(selected && selected.type === "private" && selected.id);
}

function setCallButtonsEnabled(enabled) {
  voiceCallBtn.disabled = !enabled;
  videoCallBtn.disabled = !enabled;
}

function resetCallModalControls() {
  acceptCallBtn.classList.add("hidden");
  rejectCallBtn.classList.add("hidden");
  muteCallBtn.classList.add("hidden");
  toggleCamBtn.classList.add("hidden");
  callVideos.classList.add("hidden");
}

function openCallModal({ title, status }) {
  callTitle.textContent = title;
  callStatus.textContent = status;
  callModal.classList.remove("hidden");
}

function stopLocalCallStream() {
  if (!localCallStream) return;
  localCallStream.getTracks().forEach((track) => track.stop());
  localCallStream = null;
}

function closePeerConnection() {
  if (!peerConnection) return;
  try {
    peerConnection.onicecandidate = null;
    peerConnection.ontrack = null;
    peerConnection.close();
  } catch {
    // ignore close errors
  }
  peerConnection = null;
}

function resetCallState() {
  pendingIncomingOffer = null;
  currentCallPeerId = "";
  currentCallType = "voice";
  currentCallId = "";
  isOutgoingCall = false;
  isCallMuted = false;
  isCameraEnabled = true;
  remoteVideo.srcObject = null;
  localVideo.srcObject = null;
  closePeerConnection();
  stopLocalCallStream();
  stopCallTimer();
  stopRingtone();
  resetCallModalControls();
  callModal.classList.add("hidden");
  hideCallToast();
}

async function ensureLocalMedia(type = "voice") {
  if (localCallStream) return localCallStream;

  const constraints = type === "video"
    ? { audio: true, video: true }
    : { audio: true, video: false };

  localCallStream = await navigator.mediaDevices.getUserMedia(constraints);
  localVideo.srcObject = localCallStream;
  localVideo.muted = true;
  localCallStream.getVideoTracks().forEach((track) => {
    track.enabled = type === "video";
  });

  return localCallStream;
}

function createPeerConnection(peerId) {
  closePeerConnection();
  peerConnection = new RTCPeerConnection(rtcConfig);

  peerConnection.onicecandidate = (event) => {
    if (!event.candidate || !peerId || !socket) return;
    socket.emit("webrtc:ice", { toUserId: peerId, candidate: event.candidate });
  };

  peerConnection.ontrack = (event) => {
    const [stream] = event.streams;
    if (stream) {
      remoteVideo.srcObject = stream;
      callStatus.textContent = "Connected";
      startCallTimer();
    }
  };

  if (localCallStream) {
    localCallStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localCallStream);
    });
  }

  return peerConnection;
}

async function startOutgoingCall(type) {
  if (!isPrivateChatSelected()) {
    typingStatus.textContent = "Select a private chat first";
    return;
  }
  if (!socket) {
    typingStatus.textContent = "Socket is disconnected";
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
    typingStatus.textContent = "WebRTC calling is not supported in this browser";
    return;
  }
  if (currentCallPeerId) {
    typingStatus.textContent = "A call is already in progress";
    return;
  }

  try {
    currentCallPeerId = String(selected.id);
    currentCallType = type;
    isOutgoingCall = true;
    isCallMuted = false;
    isCameraEnabled = type === "video";

    await ensureLocalMedia(type);
    createPeerConnection(currentCallPeerId);

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    openCallModal({
      title: `${type === "video" ? "Video" : "Voice"} call`,
      status: "Calling..."
    });
    setCallPeerInfo({ name: selected.title, avatar: "" });
    callVideos.classList.toggle("hidden", type !== "video");
    muteCallBtn.classList.remove("hidden");
    endCallBtn.classList.remove("hidden");
    toggleCamBtn.classList.toggle("hidden", type !== "video");

    socket.emit("webrtc:offer", {
      toUserId: currentCallPeerId,
      callType: type,
      offer: peerConnection.localDescription
    }, (ack) => {
      if (!ack?.ok) {
        typingStatus.textContent = ack?.message || "Unable to start call";
        resetCallState();
        return;
      }

      currentCallId = ack.callId || currentCallId;
      if (ack.offline) {
        upsertCall({
          id: currentCallId,
          status: "missed",
          callType: currentCallType,
          callerId: String(me?.id || ""),
          receiverId: String(currentCallPeerId),
          callerName: me?.username || "",
          receiverName: selected?.title || ""
        });
        renderCalls();
        callStatus.textContent = "User is offline · Missed call recorded";
        setTimeout(() => {
          resetCallState();
        }, 1200);
      }
    });
  } catch (error) {
    typingStatus.textContent = error?.message || "Unable to access media for call";
    resetCallState();
  }
}

async function acceptIncomingCall() {
  if (!pendingIncomingOffer || !socket) return;

  try {
    const { fromUserId, fromUsername, callType, offer, callId } = pendingIncomingOffer;
    currentCallPeerId = fromUserId;
    currentCallType = callType;
    currentCallId = callId || "";
    isOutgoingCall = false;
    isCallMuted = false;
    isCameraEnabled = callType === "video";

    await ensureLocalMedia(callType);
    createPeerConnection(fromUserId);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit("webrtc:answer", {
      toUserId: fromUserId,
      answer: peerConnection.localDescription,
      callId: currentCallId
    });

    callTitle.textContent = `${callType === "video" ? "Video" : "Voice"} call`;
    setCallPeerInfo({ name: fromUsername, avatar: "" });
    callStatus.textContent = "Connecting...";
    callVideos.classList.toggle("hidden", callType !== "video");
    acceptCallBtn.classList.add("hidden");
    rejectCallBtn.classList.add("hidden");
    muteCallBtn.classList.remove("hidden");
    toggleCamBtn.classList.toggle("hidden", callType !== "video");
    pendingIncomingOffer = null;
    stopRingtone();
  } catch (error) {
    typingStatus.textContent = error?.message || "Failed to accept call";
    resetCallState();
  }
}

function rejectIncomingCall() {
  if (!pendingIncomingOffer || !socket) {
    resetCallState();
    return;
  }

  socket.emit("webrtc:reject", {
    toUserId: pendingIncomingOffer.fromUserId,
    callId: pendingIncomingOffer.callId || currentCallId
  });
  stopRingtone();
  resetCallState();
}

function endCurrentCall(notifyPeer = true) {
  if (notifyPeer && socket && currentCallPeerId) {
    socket.emit("webrtc:end", { toUserId: currentCallPeerId, callId: currentCallId });
  }
  resetCallState();
}

function isNearBottom() {
  const distance = messagesEl.scrollHeight - (messagesEl.scrollTop + messagesEl.clientHeight);
  return distance < 64;
}

function scrollToLatest(force = false) {
  if (force || isNearBottom() || shouldStickToBottom) {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

function renderMessageSkeleton(count = 6) {
  const skeleton = document.createElement("div");
  skeleton.className = "msg-skeleton";
  for (let index = 0; index < count; index += 1) {
    const item = document.createElement("div");
    item.className = `bubble-sk skeleton-item ${index % 2 ? "right" : ""}`;
    skeleton.appendChild(item);
  }
  messagesEl.innerHTML = "";
  messagesEl.appendChild(skeleton);
}

function renderListSkeleton(listEl, rows = 4) {
  listEl.innerHTML = "";
  const skeleton = document.createElement("div");
  skeleton.className = "list-skeleton";

  for (let index = 0; index < rows; index += 1) {
    const row = document.createElement("div");
    row.className = "row";

    const avatar = document.createElement("div");
    avatar.className = "avatar-sk skeleton-item";

    const line = document.createElement("div");
    line.className = "line-sk skeleton-item";

    row.append(avatar, line);
    skeleton.appendChild(row);
  }

  listEl.appendChild(skeleton);
}

function setComposerEnabled(enabled) {
  messageInput.disabled = !enabled;
  fileInput.disabled = !enabled;
  voiceBtn.disabled = !enabled;
  locationBtn.disabled = !enabled;
  emojiBtn.disabled = !enabled;
  document.getElementById("sendBtn").disabled = !enabled;
}

function resetRecorderUI() {
  isRecording = false;
  voiceBtn.classList.remove("recording");
  voiceBtn.title = "Record voice message";
  voiceBtn.textContent = "🎤";
  voiceTimer.classList.add("hidden");
  voiceTimer.textContent = "00:00";

  if (recordingTimerId) {
    clearInterval(recordingTimerId);
    recordingTimerId = null;
  }
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatCallTime(dateValue) {
  if (!dateValue) return "";
  return new Date(dateValue).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function updateCallBadge() {
  if (!callBadge) return;
  callBadge.textContent = String(missedCallCount || 0);
  callBadge.classList.toggle("hidden", missedCallCount <= 0);
}

function openSidebar() {
  sidebar?.classList.add("open");
  sidebarOverlay?.classList.remove("hidden");
}

function closeSidebar() {
  sidebar?.classList.remove("open");
  sidebarOverlay?.classList.add("hidden");
}

function toggleSidebar() {
  if (sidebar?.classList.contains("open")) {
    closeSidebar();
  } else {
    openSidebar();
  }
}

function showCallToast({ title, text, avatar, mode, autoHideMs = 0 }) {
  if (!callToast) return;
  callToastTitle.textContent = title || "Incoming call";
  callToastText.textContent = text || "Incoming call...";
  callToastAvatar.textContent = initials(title || "?");
  if (avatar) {
    callToastAvatar.style.backgroundImage = `url(${avatar})`;
    callToastAvatar.style.backgroundSize = "cover";
    callToastAvatar.style.backgroundPosition = "center";
  } else {
    callToastAvatar.style.backgroundImage = "";
  }

  const isIncoming = mode === "incoming";
  callToastAccept.classList.toggle("hidden", !isIncoming);
  callToastReject.classList.toggle("hidden", !isIncoming);
  callToastCallback.classList.toggle("hidden", isIncoming);

  callToast.classList.remove("hidden");
  requestAnimationFrame(() => callToast.classList.add("show"));

  if (callToastTimerId) {
    clearTimeout(callToastTimerId);
    callToastTimerId = null;
  }

  if (autoHideMs > 0) {
    callToastTimerId = setTimeout(() => {
      hideCallToast();
    }, autoHideMs);
  }
}

function hideCallToast() {
  if (!callToast) return;
  if (callToastTimerId) {
    clearTimeout(callToastTimerId);
    callToastTimerId = null;
  }
  callToast.classList.remove("show");
  setTimeout(() => callToast.classList.add("hidden"), 200);
}

function startCallTimer() {
  callConnectedAt = Date.now();
  if (callTimerId) clearInterval(callTimerId);
  callTimerId = setInterval(() => {
    const elapsed = formatDuration(Date.now() - callConnectedAt);
    callStatus.textContent = `Connected · ${elapsed}`;
  }, 500);
}

function stopCallTimer() {
  if (callTimerId) {
    clearInterval(callTimerId);
    callTimerId = null;
  }
  callConnectedAt = 0;
}

function startRingtone() {
  if (callRingtoneId) return;
  const playTone = () => {
    try {
      if (!callAudioCtx) {
        callAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = callAudioCtx;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(520, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.3);
    } catch {
      // ignore audio errors
    }
  };
  playTone();
  callRingtoneId = setInterval(playTone, 1500);
}

function stopRingtone() {
  if (callRingtoneId) {
    clearInterval(callRingtoneId);
    callRingtoneId = null;
  }
}

function setCallPeerInfo({ name, avatar }) {
  if (callPeerName) callPeerName.textContent = name || "Contact";
  if (callAvatar) callAvatar.textContent = initials(name || "?");
  if (callAvatar && avatar) {
    callAvatar.style.backgroundImage = `url(${avatar})`;
    callAvatar.style.backgroundSize = "cover";
    callAvatar.style.backgroundPosition = "center";
  } else if (callAvatar) {
    callAvatar.style.backgroundImage = "";
  }
}

function upsertCall(call) {
  if (!call?.id) return;
  const index = callHistory.findIndex((c) => c.id === call.id);
  if (index >= 0) {
    callHistory[index] = { ...callHistory[index], ...call };
  } else {
    callHistory.unshift(call);
  }
}

function renderCalls() {
  if (!callsList) return;
  callsList.innerHTML = "";
  if (!callHistory.length) return;

  callHistory.forEach((call) => {
    const li = document.createElement("li");

    const item = document.createElement("div");
    item.className = "call-item";

    const avatar = document.createElement("div");
    avatar.className = "avatar";

    const isCaller = String(call.callerId) === String(me?.id || "");
    const peerName = isCaller ? call.receiverName : call.callerName;
    const peerAvatar = isCaller ? call.receiverAvatar : call.callerAvatar;
    avatar.textContent = initials(peerName);
    if (peerAvatar) {
      avatar.style.backgroundImage = `url(${peerAvatar})`;
      avatar.style.backgroundSize = "cover";
      avatar.style.backgroundPosition = "center";
    }

    const meta = document.createElement("div");
    meta.className = "meta";
    const nameEl = document.createElement("div");
    nameEl.className = "item-name";
    nameEl.textContent = peerName || "Unknown";

    const details = document.createElement("div");
    details.className = "call-type";
    details.textContent = `${call.callType} · ${call.status} · ${formatCallTime(call.startedAt)}`;
    meta.append(nameEl, details);

    const action = document.createElement("button");
    action.type = "button";
    action.className = "call-action";
    action.textContent = "Call back";
    action.addEventListener("click", () => {
      if (!peerName || !call) return;
      closeSidebar();
      selected = { type: "private", id: isCaller ? call.receiverId : call.callerId, title: peerName };
      updateChatHeader();
      renderUsers();
      renderRooms();
      startOutgoingCall(call.callType || "voice");
    });

    item.append(avatar, meta, action);
    li.appendChild(item);
    callsList.appendChild(li);
  });
}

function startRecorderTimer() {
  recordingStartedAt = Date.now();
  voiceTimer.classList.remove("hidden");
  voiceTimer.textContent = "00:00";

  if (recordingTimerId) {
    clearInterval(recordingTimerId);
  }

  recordingTimerId = setInterval(() => {
    voiceTimer.textContent = formatDuration(Date.now() - recordingStartedAt);
  }, 250);
}

function stopMediaStream() {
  if (!mediaStream) return;
  mediaStream.getTracks().forEach((track) => track.stop());
  mediaStream = null;
}

function finalizeRecording(blob) {
  if (!blob || blob.size === 0) {
    attachmentPreview.textContent = "Voice recording is empty";
    return;
  }

  const mimeType = blob.type && ALLOWED_UPLOADS.has(blob.type) ? blob.type : "audio/webm";
  const ext = mimeType === "audio/ogg"
    ? "ogg"
    : mimeType === "audio/mpeg"
      ? "mp3"
      : mimeType === "audio/wav"
        ? "wav"
        : mimeType === "audio/mp4"
          ? "m4a"
          : "webm";

  selectedAttachment = new File([blob], `voice-${Date.now()}.${ext}`, { type: mimeType });
  attachmentPreview.textContent = `Voice message ready: ${selectedAttachment.name}`;
}

function openAudioFilePicker() {
  fileInput.click();
}

function microphoneErrorMessage(error) {
  const code = error?.name || "UnknownError";
  if (code === "NotAllowedError" || code === "SecurityError") {
    return "Microphone access denied. Allow microphone permission in browser site settings.";
  }
  if (code === "NotFoundError" || code === "DevicesNotFoundError") {
    return "No microphone device found. Connect a mic and try again.";
  }
  if (code === "NotReadableError" || code === "TrackStartError") {
    return "Microphone is busy in another app. Close other recording apps and retry.";
  }
  if (code === "OverconstrainedError") {
    return "Microphone constraints are not supported on this device.";
  }
  return "Microphone is unavailable on this browser/device.";
}

async function startVoiceRecording() {
  if (!window.MediaRecorder || !navigator.mediaDevices?.getUserMedia) {
    typingStatus.textContent = "Voice recording is not supported. Choose an audio file instead.";
    openAudioFilePicker();
    return;
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recorderChunks = [];

    const preferredType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
    mediaRecorder = preferredType ? new MediaRecorder(mediaStream, { mimeType: preferredType }) : new MediaRecorder(mediaStream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data?.size > 0) recorderChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      const type = recorderChunks[0]?.type || mediaRecorder?.mimeType || "audio/webm";
      const blob = new Blob(recorderChunks, { type });
      finalizeRecording(blob);
      stopMediaStream();
      mediaRecorder = null;
      recorderChunks = [];
      resetRecorderUI();
      typingStatus.textContent = "";
    };

    mediaRecorder.start();
    isRecording = true;
    startRecorderTimer();
    voiceBtn.classList.add("recording");
    voiceBtn.title = "Stop recording";
    voiceBtn.textContent = "⏹";
    typingStatus.textContent = "Recording voice message... click stop when done";
  } catch (error) {
    stopMediaStream();
    mediaRecorder = null;
    resetRecorderUI();
    typingStatus.textContent = `${microphoneErrorMessage(error)} You can still attach audio manually.`;
    openAudioFilePicker();
  }
}

function stopVoiceRecording() {
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    resetRecorderUI();
    stopMediaStream();
    return;
  }
  mediaRecorder.stop();
}

function updateLocationButtonUI() {
  locationBtn.classList.toggle("location-sharing", isLocationSharing);
  locationBtn.textContent = isLocationSharing ? "⏹" : "📍";
  locationBtn.title = isLocationSharing ? "Stop live location" : "Share live location";
}

function buildLocationMessage({ latitude, longitude, accuracy }) {
  return `${LOCATION_MESSAGE_PREFIX}:${latitude.toFixed(6)},${longitude.toFixed(6)},${Math.round(accuracy || 0)},${Date.now()}`;
}

function parseLocationMessage(rawMessage) {
  const text = String(rawMessage || "");
  if (!text.startsWith(`${LOCATION_MESSAGE_PREFIX}:`)) return null;

  const payload = text.slice(`${LOCATION_MESSAGE_PREFIX}:`.length);
  const [latRaw, lngRaw, accRaw, tsRaw] = payload.split(",");

  const latitude = Number(latRaw);
  const longitude = Number(lngRaw);
  const accuracy = Number(accRaw || 0);
  const timestamp = Number(tsRaw || Date.now());

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  return { latitude, longitude, accuracy, timestamp };
}

function distanceMeters(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const r = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const aa = s1 * s1 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * s2 * s2;
  return 2 * r * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

function emitLocationByCoords({ latitude, longitude, accuracy = 0, force = false }) {
  if (!socket || !selected) return;

  const now = Date.now();
  const coords = { latitude, longitude };
  const movedMeters = distanceMeters(lastLocationCoords, coords);
  const enoughTimePassed = now - lastLocationSentAt >= LOCATION_SEND_INTERVAL_MS;
  const movedEnough = movedMeters >= LOCATION_MIN_MOVE_METERS;

  if (!force && lastLocationSentAt && !enoughTimePassed && !movedEnough) return;

  lastLocationSentAt = now;
  lastLocationCoords = coords;

  const message = buildLocationMessage({ latitude, longitude, accuracy });
  socket.emit(
    "sendMessage",
    selected.type === "private"
      ? { receiverId: selected.id, message }
      : { roomId: selected.id, message },
    (ack) => {
      if (!ack?.ok) {
        typingStatus.textContent = ack?.message || "Failed to send live location";
      }
    }
  );
}

function parseManualLocationInput(rawInput) {
  const value = String(rawInput || "").trim();
  if (!value) return null;

  const coordinateMatch = value.match(/(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (!coordinateMatch) return null;

  const latitude = Number(coordinateMatch[1]);
  const longitude = Number(coordinateMatch[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  return { latitude, longitude, accuracy: 0 };
}

function promptManualLocationShare(reasonText) {
  if (!selected) return;

  const input = window.prompt(
    `${reasonText}\n\nPaste location as "lat,lng" or a Google Maps URL:`
  );

  if (!input) return;

  const parsed = parseManualLocationInput(input);
  if (!parsed) {
    typingStatus.textContent = "Invalid location format. Example: 28.6139,77.2090";
    return;
  }

  emitLocationByCoords({ ...parsed, force: true });
  typingStatus.textContent = "Location sent manually";
}

function emitLocationMessage(position) {
  if (!socket || !selected) return;

  const { latitude, longitude, accuracy } = position.coords;
  emitLocationByCoords({ latitude, longitude, accuracy });
}

function stopLocationSharing({ silent = false } = {}) {
  if (locationWatchId !== null) {
    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
  }

  isLocationSharing = false;
  lastLocationSentAt = 0;
  lastLocationCoords = null;
  updateLocationButtonUI();

  if (!silent) {
    typingStatus.textContent = "Live location stopped";
  }
}

function getLocationErrorMessage(error) {
  if (!error) return "Unable to access location.";
  if (error.code === 1) return "Location permission denied. Allow location access in browser settings.";
  if (error.code === 2) return "Location unavailable. Check GPS/network and try again.";
  if (error.code === 3) return "Location request timed out. Try again in open sky/network.";
  return "Unable to read location from this device.";
}

function startLocationSharing() {
  if (!navigator.geolocation) {
    const message = "Geolocation is not supported in this browser";
    typingStatus.textContent = message;
    promptManualLocationShare(message);
    return;
  }

  if (!socket || !selected) {
    typingStatus.textContent = "Select a user or room first";
    return;
  }

  isLocationSharing = true;
  updateLocationButtonUI();
  typingStatus.textContent = "Live location started";

  locationWatchId = navigator.geolocation.watchPosition(
    (position) => {
      if (!isLocationSharing) return;
      emitLocationMessage(position);
    },
    (error) => {
      const message = getLocationErrorMessage(error);
      typingStatus.textContent = message;
      stopLocationSharing({ silent: true });
      promptManualLocationShare(message);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 8000,
      timeout: 12000
    }
  );
}

function clearPendingAttachmentAndRecording() {
  if (isRecording) {
    stopVoiceRecording();
  }
  if (isLocationSharing) {
    stopLocationSharing({ silent: true });
  }
  selectedAttachment = null;
  fileInput.value = "";
  attachmentPreview.textContent = "";
}

function resetProfilePanel() {
  activeProfileData = null;
  profileAvatar.textContent = "?";
  profileName.textContent = "Select a contact";
  profilePresence.textContent = "No chat selected";
  profilePhone.textContent = "Not shared";
  profileEmail.textContent = "Not shared";
  profileAbout.textContent = "—";
  profileStats.textContent = "0 media · 0 messages";
  profileMediaGrid.innerHTML = "";
  toggleFavouriteBtn.textContent = "Add to favourites";
  toggleBlockBtn.textContent = "Block user";
}

function openMediaPreview(url) {
  if (!url) return;
  mediaPreviewImage.src = url;
  mediaPreviewModal.classList.remove("hidden");
}

function closeMediaPreview() {
  mediaPreviewImage.src = "";
  mediaPreviewModal.classList.add("hidden");
}

function closeProfilePanel() {
  profilePanel.classList.remove("open");
  profilePanel.setAttribute("aria-hidden", "true");
  profilePanelOverlay.classList.add("hidden");
  closeMediaPreview();
}

function isProfilePanelOpen() {
  return profilePanel.classList.contains("open");
}

function renderProfileMedia(mediaItems) {
  profileMediaGrid.innerHTML = "";

  if (!mediaItems.length) {
    const empty = document.createElement("div");
    empty.className = "profile-media-item";
    empty.textContent = "No shared media";
    profileMediaGrid.appendChild(empty);
    return;
  }

  mediaItems.forEach((entry) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "profile-media-item";

    const mime = String(entry?.attachment?.mimeType || "");
    const url = String(entry?.attachment?.url || "");
    const fileName = String(entry?.attachment?.fileName || "Attachment");

    if (mime.startsWith("image/") && url) {
      const img = document.createElement("img");
      img.src = url;
      img.alt = fileName;
      item.appendChild(img);
      item.addEventListener("click", () => openMediaPreview(url));
    } else {
      item.textContent = mime.startsWith("audio/") ? "🎤 Audio" : "📄 File";
      item.title = fileName;
      item.addEventListener("click", () => {
        if (url) window.open(url, "_blank", "noopener");
      });
    }

    profileMediaGrid.appendChild(item);
  });
}

async function loadProfilePanelData(userId) {
  if (!userId) return;

  profileName.textContent = "Loading...";
  profilePresence.textContent = "Fetching contact details";
  profilePhone.textContent = "Loading...";
  profileEmail.textContent = "Loading...";
  profileAbout.textContent = "";
  profileStats.textContent = "";
  profileMediaGrid.innerHTML = "";

  try {
    const [profileResp, mediaResp] = await Promise.all([
      api(`/chat/profile/${userId}`),
      api(`/chat/profile/${userId}/media?limit=18`)
    ]);

    if (!selected || selected.type !== "private" || String(selected.id) !== String(userId)) return;

    const profile = profileResp.profile;
    const media = Array.isArray(mediaResp.media) ? mediaResp.media : [];
    activeProfileData = profile;

    profileAvatar.textContent = initials(profile.username);
    profileName.textContent = profile.username;
    profilePresence.textContent = profile.isOnline ? "Online" : lastSeenText(profile);
    profilePhone.textContent = profile.phone || "Not shared";
    profileEmail.textContent = profile.email || "Not shared";
    profileAbout.textContent = profile.about || "Hey there! I am using Realtime Chat.";
    profileStats.textContent = `${profile.stats?.mediaCount || 0} media · ${profile.stats?.messageCount || 0} messages`;
    toggleFavouriteBtn.textContent = profile.favourite ? "Remove from favourites" : "Add to favourites";
    toggleBlockBtn.textContent = profile.blockedByMe ? "Unblock user" : "Block user";
    renderProfileMedia(media);

    if (profile.blockedByMe) {
      typingStatus.textContent = "You blocked this user";
      setComposerEnabled(false);
    } else if (profile.blockedMe) {
      typingStatus.textContent = "This user has blocked you";
      setComposerEnabled(false);
    } else if (selected?.type === "private" && String(selected.id) === String(userId)) {
      setComposerEnabled(true);
      if (
        typingStatus.textContent === "You blocked this user"
        || typingStatus.textContent === "This user has blocked you"
      ) {
        typingStatus.textContent = "";
      }
    }
  } catch (error) {
    profileName.textContent = "Unable to load contact";
    profilePresence.textContent = error.message || "Try again";
  }
}

async function openProfilePanel() {
  if (!selected || selected.type !== "private") return;
  profilePanel.classList.add("open");
  profilePanel.setAttribute("aria-hidden", "false");
  profilePanelOverlay.classList.remove("hidden");
  await loadProfilePanelData(selected.id);
}

function renderSelectedMessages({ preserveOffset = false, forceBottom = false } = {}) {
  if (!selected) return;

  const key = selectedKey();
  const cachedMessages = messageCacheByChat.get(key) || [];
  const renderedCount = renderedCountByChat.get(key) || Math.min(MESSAGES_PAGE_SIZE, cachedMessages.length);
  const sliceStart = Math.max(0, cachedMessages.length - renderedCount);
  const visibleMessages = cachedMessages.slice(sliceStart);

  const previousScrollHeight = messagesEl.scrollHeight;
  messagesEl.innerHTML = "";
  visibleMessages.forEach((message) => renderMessage(message, { autoScroll: false }));

  if (preserveOffset) {
    const diff = messagesEl.scrollHeight - previousScrollHeight;
    messagesEl.scrollTop += diff;
  } else {
    scrollToLatest(forceBottom);
  }
}

async function loadOlderMessages() {
  if (!selected || isFetchingMessages || isLoadingOlder) return;

  const key = selectedKey();
  const cached = messageCacheByChat.get(key) || [];
  const currentlyRendered = renderedCountByChat.get(key) || 0;

  if (currentlyRendered >= cached.length) return;

  isLoadingOlder = true;
  setMessagesLoading(true, "Loading older messages...");

  const nextRendered = Math.min(cached.length, currentlyRendered + MESSAGES_PAGE_SIZE);
  renderedCountByChat.set(key, nextRendered);
  renderSelectedMessages({ preserveOffset: true });

  setMessagesLoading(false);
  isLoadingOlder = false;
}

async function fetchAndRenderMessagesForSelected() {
  if (!selected) return;

  const loadSeq = ++activeChatLoadSeq;
  const key = selectedKey();
  clearUnreadForSelectedChat();
  isFetchingMessages = true;

  setEmptyStateVisibility(false);
  setMessagesLoading(true, "Loading messages...");
  renderMessageSkeleton(6);

  try {
    const data = selected.type === "private"
      ? await api(`/chat/messages/private/${selected.id}`)
      : await api(`/chat/messages/room/${selected.id}`);

    if (loadSeq !== activeChatLoadSeq) return;

    const messages = Array.isArray(data.messages) ? data.messages : [];
    messageCacheByChat.set(key, messages);
    renderedCountByChat.set(key, Math.min(MESSAGES_PAGE_SIZE, messages.length));

    if (messages.length === 0) {
      messagesEl.innerHTML = "";
      setEmptyStateVisibility(true);
      emptyState.textContent = selected.type === "private" ? "No messages yet" : "No room messages yet";
      return;
    }

    setEmptyStateVisibility(false);
    renderSelectedMessages({ forceBottom: true });
    if (selected.type === "private") markVisiblePrivateMessagesRead();
  } finally {
    if (loadSeq === activeChatLoadSeq) {
      isFetchingMessages = false;
      setMessagesLoading(false);
    }
  }
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(740, ctx.currentTime);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.1);
  } catch {
    // ignore audio failures
  }
}

function setTab(mode) {
  const isLogin = mode === "login";
  loginTab.classList.toggle("active", isLogin);
  registerTab.classList.toggle("active", !isLogin);
  loginForm.classList.toggle("active", isLogin);
  registerForm.classList.toggle("active", !isLogin);
  authCard?.setAttribute("data-mode", mode);
  setAuthMessage("");
}

function setAuthMessage(text, type = "") {
  authMessage.textContent = text || "";
  authMessage.classList.remove("error", "success", "visible");
  if (!text) return;
  if (type) authMessage.classList.add(type);
  authMessage.classList.add("visible");
}

function setButtonLoading(button, isLoading, labelOverride = "") {
  if (!button) return;
  const label = button.querySelector(".btn-label");
  if (!button.dataset.defaultLabel) {
    button.dataset.defaultLabel = label?.textContent || button.textContent || "";
  }
  button.classList.toggle("btn-loading", isLoading);
  button.disabled = isLoading;
  if (label) {
    label.textContent = isLoading && labelOverride ? labelOverride : button.dataset.defaultLabel;
  }
}

function clearErrors(prefixes) {
  prefixes.forEach((id) => {
    document.getElementById(id).textContent = "";
  });
}

function activePeer() {
  if (!selected || selected.type !== "private") return null;
  return users.find((user) => user.id === selected.id) || null;
}

function updateChatHeader() {
  if (!selected) {
    chatTitle.textContent = "Select a user";
    chatPresenceText.textContent = "No chat selected";
    chatPresenceDot.className = "status-dot offline";
    chatAvatar.textContent = "#";
    chatOnlineBadge.classList.add("hidden");
    chatAvatarWrap.classList.remove("presence-online", "presence-offline");
    profilePanelTrigger.setAttribute("aria-disabled", "true");
    setCallButtonsEnabled(false);
    closeProfilePanel();
    return;
  }

  if (selected.type === "room") {
    chatTitle.textContent = `Room: ${selected.title}`;
    chatPresenceText.textContent = "Group chat";
    chatPresenceDot.className = "status-dot online";
    chatAvatar.textContent = "#";
    chatOnlineBadge.classList.add("hidden");
    chatAvatarWrap.classList.remove("presence-online");
    chatAvatarWrap.classList.add("presence-offline");
    profilePanelTrigger.setAttribute("aria-disabled", "true");
    setCallButtonsEnabled(false);
    closeProfilePanel();
    return;
  }

  const peer = activePeer();
  chatTitle.textContent = `${peer?.username || selected.title}`;
  chatPresenceText.textContent = lastSeenText(peer);
  const isOnline = Boolean(peer?.isOnline);
  chatPresenceDot.className = `status-dot ${isOnline ? "online" : "offline"}`;
  chatAvatar.textContent = initials(peer?.username || selected.title);
  profilePanelTrigger.setAttribute("aria-disabled", "false");
  setCallButtonsEnabled(true);

  chatOnlineBadge.classList.toggle("hidden", !isOnline);
  chatAvatarWrap.classList.toggle("presence-online", isOnline);
  chatAvatarWrap.classList.toggle("presence-offline", !isOnline);
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include"
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}

async function loadCallHistory() {
  try {
    const data = await api("/chat/calls?limit=30");
    callHistory = Array.isArray(data.calls) ? data.calls : [];
    renderCalls();
  } catch {
    // ignore call history failures
  }
}

async function loadMissedCalls() {
  try {
    const data = await api("/chat/calls/missed");
    const missed = Array.isArray(data.calls) ? data.calls : [];
    missedCallCount = missed.length;
    missed.forEach((call) => upsertCall(call));
    updateCallBadge();
    renderCalls();
    if (missed[0]) {
      currentCallPeerId = String(missed[0].callerId || "");
      currentCallType = missed[0].callType || "voice";
      showCallToast({
        title: missed[0].callerName || "Missed call",
        text: `Missed call · ${formatCallTime(missed[0].startedAt)}`,
        avatar: missed[0].callerAvatar || "",
        mode: "missed",
        autoHideMs: 5000
      });
    }
  } catch {
    // ignore missed call failures
  }
}

async function login(email, password) {
  const data = await api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  token = data.token || "";
  return data.user;
}

async function register(username, email, password) {
  const data = await api("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ username, email, password })
  });
  token = data.token || "";
  return data.user;
}

function renderAttachment(attachment) {
  if (!attachment?.url) return null;

  const wrap = document.createElement("div");
  wrap.className = "attachment";

  const link = document.createElement("a");
  link.target = "_blank";
  link.rel = "noopener";
  link.href = attachment.url;

  if (String(attachment.mimeType || "").startsWith("image/")) {
    const img = document.createElement("img");
    img.src = attachment.url;
    img.alt = attachment.fileName || "image";
    link.appendChild(img);
    wrap.appendChild(link);
  } else if (String(attachment.mimeType || "").startsWith("audio/")) {
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = attachment.url;
    audio.preload = "metadata";
    wrap.appendChild(audio);
  } else {
    link.textContent = `📎 ${attachment.fileName || "Attachment"}`;
    wrap.appendChild(link);
  }

  return wrap;
}

function renderMessage(message, { autoScroll = true, forceScroll = false } = {}) {
  const isMe = String(message.senderId) === String(me.id);
  const bubble = document.createElement("div");
  bubble.className = `bubble ${isMe ? "me" : "other"}`;
  bubble.dataset.id = message._id;
  bubble.dataset.status = message.status || "sent";

  const senderName = isMe ? "You" : users.find((u) => u.id === String(message.senderId))?.username || "User";

  const sender = document.createElement("div");
  sender.className = "sender";
  sender.textContent = senderName;
  bubble.appendChild(sender);

  const locationPayload = parseLocationMessage(message.message);
  if (locationPayload) {
    const locationCard = document.createElement("div");
    locationCard.className = "location-card";

    const label = document.createElement("div");
    label.className = "label";
    label.textContent = "📍 Live location";

    const coords = document.createElement("div");
    coords.className = "coords";
    coords.textContent = `${locationPayload.latitude.toFixed(6)}, ${locationPayload.longitude.toFixed(6)} · ±${Math.max(1, Math.round(locationPayload.accuracy || 0))}m`;

    const link = document.createElement("a");
    link.href = `https://maps.google.com/?q=${locationPayload.latitude},${locationPayload.longitude}`;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Open in Maps";

    locationCard.append(label, coords, link);
    bubble.appendChild(locationCard);
  } else {
    const text = document.createElement("div");
    text.className = "text";
    text.textContent = message.message || "";
    bubble.appendChild(text);
  }

  const attachmentEl = renderAttachment(message.attachment);
  if (attachmentEl) bubble.appendChild(attachmentEl);

  const meta = document.createElement("div");
  meta.className = "meta";

  const time = document.createElement("span");
  time.textContent = timeText(message.timestamp);
  meta.appendChild(time);

  if (isMe) {
    const read = document.createElement("span");
    read.className = "read";
    read.textContent = getReceiptForStatus(message.status);
    read.classList.add(getReceiptClass(message.status));
    meta.appendChild(read);
  }

  bubble.appendChild(meta);
  messagesEl.appendChild(bubble);

  if (autoScroll) {
    scrollToLatest(forceScroll || isMe);
  }
}

function updateMessageStatus(messageIds, status) {
  if (!Array.isArray(messageIds) || !status) return;

  messageIds.forEach((id) => {
    const bubble = messagesEl.querySelector(`.bubble[data-id="${id}"]`);
    if (!bubble) return;
    bubble.dataset.status = status;

    const isMine = bubble.classList.contains("me");
    if (!isMine) return;

    const meta = bubble.querySelector(".meta");
    if (!meta) return;

    const readEl = meta.querySelector(".read");
    const icon = getReceiptForStatus(status);

    if (readEl) {
      readEl.textContent = icon;
      readEl.classList.remove("read-sent", "read-delivered", "read-seen");
      readEl.classList.add(getReceiptClass(status));
    } else {
      const read = document.createElement("span");
      read.className = "read";
      read.textContent = icon;
      read.classList.add(getReceiptClass(status));
      meta.appendChild(read);
    }
  });
}

async function uploadAttachment(file) {
  const formData = new FormData();
  formData.append("file", file);

  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(`${API_BASE}/chat/upload`, {
    method: "POST",
    headers,
    body: formData,
    credentials: "include"
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Upload failed");
  return data.attachment;
}

function markVisiblePrivateMessagesRead() {
  if (!socket || selected?.type !== "private") return;

  const unreadIds = Array.from(messagesEl.querySelectorAll(".bubble.other[data-id]"))
    .map((el) => el.dataset.id)
    .filter(Boolean);

  if (unreadIds.length > 0) {
    socket.emit("markRead", { messageIds: unreadIds });
  }
}

function filteredUsers() {
  const query = userSearchInput.value.trim().toLowerCase();
  if (!query) return users;
  return users.filter((user) => user.username.toLowerCase().includes(query));
}

function renderUsers() {
  usersList.innerHTML = "";

  filteredUsers().forEach((user) => {
    const li = document.createElement("li");
    li.className = selected?.type === "private" && selected.id === user.id ? "active" : "";

    const left = document.createElement("div");
    left.className = "item-user";

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = initials(user.username);

    const info = document.createElement("div");
    const name = document.createElement("div");
    name.className = "item-name";
    name.textContent = user.username;

    const hint = document.createElement("div");
    hint.className = "item-hint";
    hint.textContent = user.isOnline ? "Online" : "Offline";

    info.append(name, hint);
    left.append(avatar, info);

    const right = document.createElement("div");
    right.className = "item-meta";

    const statusDot = document.createElement("span");
    statusDot.className = `status-dot ${user.isOnline ? "online" : "offline"}`;
    right.appendChild(statusDot);

    const unreadCount = unreadByChat.get(privateChatKey(user.id)) || 0;
    if (unreadCount > 0) {
      const unread = document.createElement("span");
      unread.className = "unread-badge";
      unread.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
      right.appendChild(unread);
    }

    li.append(left, right);
    li.addEventListener("click", async () => {
      closeSidebar();
      clearPendingAttachmentAndRecording();
      closeProfilePanel();
      selected = { type: "private", id: user.id, title: user.username };
      clearUnreadForSelectedChat();
      updateChatHeader();
      renderUsers();
      renderRooms();
      typingStatus.textContent = "";
      messagesEl.innerHTML = "";
      setEmptyStateVisibility(false);
      setComposerEnabled(true);
      await fetchAndRenderMessagesForSelected();
    });

    usersList.appendChild(li);
  });
}

function renderRooms() {
  roomsList.innerHTML = "";

  rooms.forEach((room) => {
    const li = document.createElement("li");
    li.className = selected?.type === "room" && selected.id === room.id ? "active" : "";

    const title = document.createElement("span");
    title.textContent = `# ${room.name}`;

    const right = document.createElement("div");
    right.className = "item-meta";

    const unreadCount = unreadByChat.get(roomChatKey(room.id)) || 0;
    if (unreadCount > 0) {
      const unread = document.createElement("span");
      unread.className = "unread-badge";
      unread.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
      right.appendChild(unread);
    }

    li.append(title, right);

    li.addEventListener("click", async () => {
      closeSidebar();
      clearPendingAttachmentAndRecording();
      closeProfilePanel();
      selected = { type: "room", id: room.id, title: room.name };
      clearUnreadForSelectedChat();
      updateChatHeader();
      renderUsers();
      renderRooms();
      typingStatus.textContent = "";
      messagesEl.innerHTML = "";
      setEmptyStateVisibility(false);
      setComposerEnabled(true);
      await fetchAndRenderMessagesForSelected();
    });

    roomsList.appendChild(li);
  });
}

function isSelectedPrivateMessage(message) {
  if (selected?.type !== "private") return false;
  const selectedId = String(selected.id);
  const senderId = String(message.senderId || "");
  const receiverId = String(message.receiverId || "");
  const meId = String(me?.id || "");

  const sentByMeToSelected = senderId === meId && receiverId === selectedId;
  const receivedFromSelected = senderId === selectedId && receiverId === meId;
  return sentByMeToSelected || receivedFromSelected;
}

function connectSocket() {
  const options = { withCredentials: true };
  if (token) options.auth = { token };
  socket = io(SOCKET_URL, options);

  socket.on("userStatus", ({ userId, isOnline, lastSeen }) => {
    const target = users.find((u) => String(u.id) === String(userId));
    if (target) {
      target.isOnline = isOnline;
      target.lastSeen = lastSeen || target.lastSeen || null;
      renderUsers();
      updateChatHeader();
    }
  });

  socket.on("typing", ({ userId, roomId, isTyping }) => {
    if (!selected) return;

    const fromSelectedPrivate = selected.type === "private" && String(userId) === String(selected.id);
    const fromSelectedRoom = selected.type === "room" && String(roomId) === String(selected.id);
    if (!(fromSelectedPrivate || fromSelectedRoom)) return;

    const typingUser = users.find((u) => String(u.id) === String(userId))?.username || "User";
    typingStatus.textContent = isTyping ? `${typingUser} is typing...` : "";
  });

  socket.on("receiveMessage", (message) => {
    const incomingKey = chatKeyFromIncomingMessage(message);
    const privateMessageKey = message?.receiverId
      ? `private:${String(message.senderId) === String(me.id) ? String(message.receiverId) : String(message.senderId)}`
      : null;
    const roomMessageKey = message?.roomId ? `room:${String(message.roomId)}` : null;

    const cacheKey = roomMessageKey || privateMessageKey;
    if (cacheKey) {
      const current = messageCacheByChat.get(cacheKey) || [];
      if (!current.some((item) => String(item._id) === String(message._id))) {
        messageCacheByChat.set(cacheKey, [...current, message]);
      }
    }

    const isSelectedPrivate = isSelectedPrivateMessage(message);
    const isSelectedRoom = selected?.type === "room" && String(message.roomId) === String(selected.id);
    const isVisibleTarget = isSelectedPrivate || isSelectedRoom;

    if (isVisibleTarget) {
      renderMessage(message, { forceScroll: String(message.senderId) === String(me.id) || shouldStickToBottom });

      const key = selectedKey();
      const total = (messageCacheByChat.get(key) || []).length;
      const existingRendered = renderedCountByChat.get(key) || 0;
      const nextRendered = existingRendered >= total - 1
        ? total
        : Math.max(existingRendered, Math.min(total, MESSAGES_PAGE_SIZE));
      renderedCountByChat.set(key, nextRendered);

      if (selected.type === "private" && String(message.senderId) !== String(me.id)) {
        socket.emit("markRead", { messageIds: [message._id] });
      }
    } else if (String(message.senderId) !== String(me.id)) {
      incrementUnread(incomingKey);
      renderUsers();
      renderRooms();
    }

    if (String(message.senderId) !== String(me.id)) {
      playNotificationSound();

      if (document.hidden || !document.hasFocus() || !isVisibleTarget) {
        showBrowserNotification(message);
      }
    }
  });

  socket.on("messageStatus", ({ messageIds, status }) => {
    updateMessageStatus(messageIds, status);
  });

  socket.on("messagesRead", ({ messageIds }) => {
    updateMessageStatus(messageIds, "read");
  });

  socket.on("webrtc:offer", (payload = {}) => {
    const { fromUserId, fromUsername, callType, offer, callId } = payload;
    if (!fromUserId || !offer) return;

    if (currentCallPeerId) {
      socket.emit("webrtc:reject", { toUserId: fromUserId });
      return;
    }

    pendingIncomingOffer = {
      fromUserId: String(fromUserId),
      fromUsername: String(fromUsername || "User"),
      callType: callType === "video" ? "video" : "voice",
      offer,
      callId: String(callId || "")
    };

    openCallModal({
      title: `${pendingIncomingOffer.callType === "video" ? "Video" : "Voice"} call`,
      status: `${pendingIncomingOffer.fromUsername} is calling...`
    });
    setCallPeerInfo({ name: pendingIncomingOffer.fromUsername, avatar: "" });
    resetCallModalControls();
    acceptCallBtn.classList.remove("hidden");
    rejectCallBtn.classList.remove("hidden");
    endCallBtn.classList.add("hidden");
    startRingtone();
    showCallToast({
      title: pendingIncomingOffer.fromUsername,
      text: "Incoming call...",
      avatar: "",
      mode: "incoming",
      autoHideMs: 0
    });
  });

  socket.on("webrtc:answer", async ({ fromUserId, answer, callId }) => {
    if (!peerConnection || !answer || String(fromUserId) !== String(currentCallPeerId)) return;
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      callStatus.textContent = "Connected";
      startCallTimer();
      if (callId && !currentCallId) currentCallId = String(callId);
    } catch {
      typingStatus.textContent = "Failed to establish call";
      resetCallState();
    }
  });

  socket.on("webrtc:ice", async ({ fromUserId, candidate }) => {
    if (!peerConnection || !candidate || String(fromUserId) !== String(currentCallPeerId)) return;
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // ignore broken ICE candidate
    }
  });

  socket.on("webrtc:reject", ({ fromUserId, callId }) => {
    if (String(fromUserId) !== String(currentCallPeerId)) return;
    if (callId && !currentCallId) currentCallId = String(callId);
    typingStatus.textContent = "Call declined";
    resetCallState();
  });

  socket.on("webrtc:end", ({ fromUserId, callId }) => {
    if (String(fromUserId) !== String(currentCallPeerId)) return;
    if (callId && !currentCallId) currentCallId = String(callId);
    typingStatus.textContent = "Call ended";
    resetCallState();
  });

  socket.on("call:status", ({ callId, status, callType, peerId }) => {
    if (!callId || !status) return;
    const peer = users.find((u) => String(u.id) === String(peerId)) || null;
    const fallback = {
      id: callId,
      status,
      callType: callType || currentCallType || "voice",
      callerId: String(me?.id || ""),
      receiverId: String(peerId || ""),
      callerName: me?.username || "",
      receiverName: peer?.username || "",
      receiverAvatar: peer?.avatarUrl || ""
    };
    upsertCall({ ...fallback, id: callId, status });
    renderCalls();
    if (status === "ringing") {
      callStatus.textContent = "Ringing...";
    }
    if (status === "missed") {
      callStatus.textContent = "User is offline · Missed call";
    }
    if (status === "answered") {
      callStatus.textContent = "Connected";
      startCallTimer();
    }
  });

  socket.on("call:missed", ({ calls }) => {
    if (!Array.isArray(calls) || calls.length === 0) return;
    calls.forEach((call) => upsertCall(call));
    missedCallCount += calls.length;
    updateCallBadge();
    renderCalls();
    const latest = calls[0];
    if (latest) {
      currentCallPeerId = String(latest.callerId || "");
      currentCallType = latest.callType || "voice";
      showCallToast({
        title: latest.callerName || "Missed call",
        text: `Missed call · ${formatCallTime(latest.startedAt)}`,
        avatar: latest.callerAvatar || "",
        mode: "missed",
        autoHideMs: 5000
      });
    }
  });

  socket.on("connect_error", () => {
    setAuthMessage("Session expired. Please login again.", "error");
    token = "";
    socket?.disconnect();
    showAuth();
  });

  socket.on("disconnect", () => {
    typingStatus.textContent = "Disconnected. Reconnecting...";
    resetCallState();
  });

  socket.on("connect", () => {
    if (typingStatus.textContent === "Disconnected. Reconnecting...") {
      typingStatus.textContent = "";
    }
  });
}

async function bootstrapChat() {
  renderListSkeleton(usersList);
  renderListSkeleton(roomsList, 3);

  const [meResp, usersResp, roomsResp] = await Promise.all([
    api("/auth/me"),
    api("/chat/users"),
    api("/chat/rooms")
  ]);

  me = { id: meResp.user.id, username: meResp.user.username };
  users = usersResp.users;
  rooms = roomsResp.rooms;

  meName.textContent = me.username;
  meAvatar.textContent = initials(me.username);

  selected = null;
  unreadByChat.clear();
  refreshDocumentTitle();
  messagesEl.innerHTML = "";
  updateChatHeader();
  renderUsers();
  renderRooms();
  setEmptyStateVisibility(true);
  setComposerEnabled(false);
  updateLocationButtonUI();
  await loadCallHistory();
  await loadMissedCalls();
  connectSocket();
}

function showChat() {
  authSection.classList.add("hidden");
  chatSection.classList.remove("hidden");
  requestNotificationPermissionFromGesture();
}

function showAuth() {
  authSection.classList.remove("hidden");
  chatSection.classList.add("hidden");
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearErrors(["loginEmailErr", "loginPasswordErr"]);
  setAuthMessage("");

  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value;

  let valid = true;
  if (!isEmail(email)) {
    document.getElementById("loginEmailErr").textContent = "Enter a valid email";
    valid = false;
  }
  if (!password) {
    document.getElementById("loginPasswordErr").textContent = "Password is required";
    valid = false;
  }
  if (!valid) return;

  try {
    setButtonLoading(loginBtn, true, "Logging in...");
    await login(email, password);
    setAuthMessage("Login successful. Redirecting...", "success");
    showChat();
    await bootstrapChat();
  } catch (error) {
    setAuthMessage(error.message, "error");
  } finally {
    setButtonLoading(loginBtn, false);
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearErrors(["registerUsernameErr", "registerEmailErr", "registerPasswordErr"]);
  setAuthMessage("");

  const username = document.getElementById("registerUsername").value.trim();
  const email = document.getElementById("registerEmail").value.trim().toLowerCase();
  const password = document.getElementById("registerPassword").value;

  let valid = true;
  if (username.length < 3) {
    document.getElementById("registerUsernameErr").textContent = "Username must be at least 3 characters";
    valid = false;
  }
  if (!isEmail(email)) {
    document.getElementById("registerEmailErr").textContent = "Enter a valid email";
    valid = false;
  }
  if (password.length < 6) {
    document.getElementById("registerPasswordErr").textContent = "Password must be at least 6 characters";
    valid = false;
  }
  if (!valid) return;

  try {
    setButtonLoading(registerBtn, true, "Creating...");
    await register(username, email, password);
    setAuthMessage("Account created. Signing you in...", "success");
    showChat();
    await bootstrapChat();
  } catch (error) {
    setAuthMessage(error.message, "error");
  } finally {
    setButtonLoading(registerBtn, false);
  }
});

messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!socket || !selected) {
    typingStatus.textContent = "Select a user or room first";
    return;
  }

  const text = messageInput.value.trim();
  if (!text && !selectedAttachment) return;

  let attachment = null;
  if (selectedAttachment) {
    try {
      attachment = await uploadAttachment(selectedAttachment);
    } catch (error) {
      typingStatus.textContent = error.message;
      return;
    }
  }

  socket.emit(
    "sendMessage",
    selected.type === "private"
      ? { receiverId: selected.id, message: text, attachment }
      : { roomId: selected.id, message: text, attachment },
    (ack) => {
      if (!ack?.ok) {
        typingStatus.textContent = ack?.message || "Failed to send";
      }
    }
  );

  messageInput.value = "";
  selectedAttachment = null;
  fileInput.value = "";
  attachmentPreview.textContent = "";
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  if (!ALLOWED_UPLOADS.has(file.type)) {
    attachmentPreview.textContent = "Allowed files: images, PDF, and audio (webm/ogg/mp3/wav/m4a)";
    fileInput.value = "";
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    attachmentPreview.textContent = "File too large (max 5MB)";
    fileInput.value = "";
    return;
  }

  selectedAttachment = file;
  attachmentPreview.textContent = `Attachment: ${file.name}`;
});

voiceBtn.addEventListener("click", async () => {
  if (!selected) {
    typingStatus.textContent = "Select a user or room first";
    return;
  }

  if (!isRecording) {
    await startVoiceRecording();
  } else {
    stopVoiceRecording();
  }
});

locationBtn.addEventListener("click", () => {
  if (!selected) {
    typingStatus.textContent = "Select a user or room first";
    return;
  }

  if (!isLocationSharing) {
    startLocationSharing();
  } else {
    stopLocationSharing();
  }
});

voiceCallBtn.addEventListener("click", async () => {
  await startOutgoingCall("voice");
});

videoCallBtn.addEventListener("click", async () => {
  await startOutgoingCall("video");
});

acceptCallBtn.addEventListener("click", async () => {
  await acceptIncomingCall();
  endCallBtn.classList.remove("hidden");
});

rejectCallBtn.addEventListener("click", () => {
  rejectIncomingCall();
});

endCallBtn.addEventListener("click", () => {
  endCurrentCall(true);
});

muteCallBtn.addEventListener("click", () => {
  if (!localCallStream) return;
  isCallMuted = !isCallMuted;
  localCallStream.getAudioTracks().forEach((track) => {
    track.enabled = !isCallMuted;
  });
  muteCallBtn.textContent = isCallMuted ? "Unmute" : "Mute";
});

toggleCamBtn.addEventListener("click", () => {
  if (!localCallStream || currentCallType !== "video") return;
  isCameraEnabled = !isCameraEnabled;
  localCallStream.getVideoTracks().forEach((track) => {
    track.enabled = isCameraEnabled;
  });
  toggleCamBtn.textContent = isCameraEnabled ? "Camera Off" : "Camera On";
});

messageInput.addEventListener("input", () => {
  if (!socket || !selected) return;

  socket.emit(
    "typing",
    selected.type === "private" ? { toUserId: selected.id, isTyping: true } : { roomId: selected.id, isTyping: true }
  );

  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    socket.emit(
      "typing",
      selected.type === "private" ? { toUserId: selected.id, isTyping: false } : { roomId: selected.id, isTyping: false }
    );
  }, 700);
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  clearUnreadForSelectedChat();
  renderUsers();
  renderRooms();
  if (selected?.type === "private") {
    markVisiblePrivateMessagesRead();
  }
});

sidebarToggle?.addEventListener("click", toggleSidebar);
sidebarOverlay?.addEventListener("click", closeSidebar);
callToastAccept?.addEventListener("click", () => {
  hideCallToast();
  acceptIncomingCall();
});
callToastReject?.addEventListener("click", () => {
  hideCallToast();
  rejectIncomingCall();
});
callToastCallback?.addEventListener("click", () => {
  hideCallToast();
  if (currentCallPeerId) startOutgoingCall(currentCallType || "voice");
});

window.addEventListener("focus", () => {
  clearUnreadForSelectedChat();
  renderUsers();
  renderRooms();
});

messagesEl.addEventListener("scroll", () => {
  shouldStickToBottom = isNearBottom();
  if (messagesEl.scrollTop <= 40) {
    loadOlderMessages();
  }
});

emojiBtn.addEventListener("click", () => {
  emojiTray.classList.toggle("hidden");
});

emojiTray.querySelectorAll(".emoji-item").forEach((button) => {
  button.addEventListener("click", () => {
    messageInput.value += button.textContent;
    emojiTray.classList.add("hidden");
    messageInput.focus();
  });
});

userSearchInput.addEventListener("input", () => {
  renderUsers();
});

createRoomBtn.addEventListener("click", async () => {
  const name = roomNameInput.value.trim();
  if (name.length < 2) return;

  try {
    const data = await api("/chat/rooms", {
      method: "POST",
      body: JSON.stringify({ name, members: users.map((u) => u.id) })
    });

    rooms.unshift(data.room);
    roomNameInput.value = "";
    renderRooms();
  } catch (error) {
    typingStatus.textContent = error.message;
  }
});

profilePanelTrigger.addEventListener("click", async () => {
  if (!selected || selected.type !== "private") return;
  if (isProfilePanelOpen()) {
    closeProfilePanel();
    return;
  }
  await openProfilePanel();
});

profilePanelTrigger.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  if (!selected || selected.type !== "private") return;
  if (isProfilePanelOpen()) {
    closeProfilePanel();
    return;
  }
  await openProfilePanel();
});

profilePanelClose.addEventListener("click", closeProfilePanel);
profilePanelOverlay.addEventListener("click", closeProfilePanel);
mediaPreviewClose.addEventListener("click", closeMediaPreview);
mediaPreviewModal.addEventListener("click", (event) => {
  if (event.target === mediaPreviewModal) closeMediaPreview();
});

toggleFavouriteBtn.addEventListener("click", async () => {
  if (!selected || selected.type !== "private" || !activeProfileData) return;
  try {
    await api(`/chat/users/${selected.id}/favourite`, {
      method: "POST",
      body: JSON.stringify({ favourite: !activeProfileData.favourite })
    });
    await loadProfilePanelData(selected.id);
  } catch (error) {
    typingStatus.textContent = error.message;
  }
});

toggleBlockBtn.addEventListener("click", async () => {
  if (!selected || selected.type !== "private" || !activeProfileData) return;
  try {
    await api(`/chat/users/${selected.id}/block`, {
      method: "POST",
      body: JSON.stringify({ blocked: !activeProfileData.blockedByMe })
    });
    await loadProfilePanelData(selected.id);
  } catch (error) {
    typingStatus.textContent = error.message;
  }
});

clearChatBtn.addEventListener("click", async () => {
  if (!selected || selected.type !== "private") return;
  const confirmClear = window.confirm("Clear all messages in this chat?");
  if (!confirmClear) return;

  try {
    await api(`/chat/conversations/private/${selected.id}/messages`, { method: "DELETE" });
    const key = selectedKey();
    messageCacheByChat.set(key, []);
    renderedCountByChat.set(key, 0);
    messagesEl.innerHTML = "";
    setEmptyStateVisibility(true);
    emptyState.textContent = "No messages yet";
    await loadProfilePanelData(selected.id);
  } catch (error) {
    typingStatus.textContent = error.message;
  }
});

deleteConversationBtn.addEventListener("click", async () => {
  if (!selected || selected.type !== "private") return;
  const confirmDelete = window.confirm("Delete this entire conversation?");
  if (!confirmDelete) return;

  try {
    await api(`/chat/conversations/private/${selected.id}`, { method: "DELETE" });
    const key = selectedKey();
    messageCacheByChat.delete(key);
    renderedCountByChat.delete(key);
    selected = null;
    messagesEl.innerHTML = "";
    setEmptyStateVisibility(true);
    setComposerEnabled(false);
    typingStatus.textContent = "Conversation deleted";
    updateChatHeader();
    renderUsers();
  } catch (error) {
    typingStatus.textContent = error.message;
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  endCurrentCall(true);
  if (isRecording) {
    stopVoiceRecording();
  }
  if (isLocationSharing) {
    stopLocationSharing({ silent: true });
  }

  try {
    await api("/auth/logout", { method: "POST" });
  } catch {
    // ignore logout failures
  }
  token = "";
  socket?.disconnect();
  callHistory = [];
  missedCallCount = 0;
  updateCallBadge();
  renderCalls();
  showAuth();
});

loginTab.addEventListener("click", () => setTab("login"));
registerTab.addEventListener("click", () => setTab("register"));

passwordToggles.forEach((button) => {
  button.addEventListener("click", () => {
    const targetId = button.dataset.target;
    const input = document.getElementById(targetId);
    if (!input) return;
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    button.textContent = isPassword ? "Hide" : "Show";
    button.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
  });
});

(() => {
  resetProfilePanel();
  setTab("login");
  showAuth();
})();
