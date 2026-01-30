(function () {
  const urlInput = document.getElementById('url');
  const authInput = document.getElementById('auth');
  const connectBtn = document.getElementById('connect');
  const disconnectBtn = document.getElementById('disconnect');
  const statusEl = document.getElementById('status');
  const userCountEl = document.getElementById('userCount');
  const roomNameInput = document.getElementById('roomName');
  const joinRoomBtn = document.getElementById('joinRoom');
  const leaveRoomBtn = document.getElementById('leaveRoom');
  const roomsListEl = document.getElementById('roomsList');
  const myRoomsEl = document.getElementById('myRooms');
  const eventNameInput = document.getElementById('eventName');
  const payloadInput = document.getElementById('payload');
  const targetTypeSelect = document.getElementById('targetType');
  const targetRoomInput = document.getElementById('targetRoom');
  const sendBtn = document.getElementById('send');
  const eventLogEl = document.getElementById('eventLog');
  const clearLogBtn = document.getElementById('clearLog');
  const pauseLogCheckbox = document.getElementById('pauseLog');
  const templateChatBtn = document.getElementById('templateChat');
  const templatePingBtn = document.getElementById('templatePing');
  const templateCustomBtn = document.getElementById('templateCustom');

  let socket = null;
  let myRooms = new Set();
  let roomsSnapshot = [];
  let logPaused = false;

  function getServerUrl() {
    const v = (urlInput.value || '').trim();
    if (v) return v;
    return window.location.origin;
  }

  function getAuth() {
    const s = (authInput && authInput.value ? authInput.value : '').trim();
    if (!s) return {};
    try {
      const parsed = JSON.parse(s);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function setConnected(connected) {
    connectBtn.disabled = connected;
    disconnectBtn.disabled = !connected;
    sendBtn.disabled = !connected;
    statusEl.textContent = connected ? 'Connected' : 'Disconnected';
    statusEl.className = 'status ' + (connected ? 'connected' : 'disconnected');
    if (!connected) {
      userCountEl.textContent = '';
      myRooms.clear();
      renderMyRooms();
      renderRoomsList();
    }
  }

  function addLogEntry(entry) {
    if (logPaused) return;
    const div = document.createElement('div');
    div.className = 'entry ' + (entry.out ? 'out' : '');
    div.innerHTML =
      '<span class="event-name">' +
      escapeHtml(entry.event) +
      '</span><span class="ts">' +
      new Date(entry.ts || Date.now()).toLocaleTimeString() +
      '</span>' +
      (entry.payload !== undefined
        ? '<div class="payload"><pre>' +
          escapeHtml(
            typeof entry.payload === 'string'
              ? entry.payload
              : JSON.stringify(entry.payload, null, 2)
          ) +
          '</pre></div>'
        : '');
    eventLogEl.appendChild(div);
    eventLogEl.scrollTop = eventLogEl.scrollHeight;
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function renderMyRooms() {
    if (myRooms.size === 0) {
      myRoomsEl.innerHTML = '<span class="text-muted">Not in any room</span>';
      return;
    }
    myRoomsEl.innerHTML =
      'In rooms: ' +
      Array.from(myRooms)
        .map(
          (r) =>
            '<span class="tag" data-room="' + escapeHtml(r) + '">' + escapeHtml(r) + '</span>'
        )
        .join(' ');
  }

  function renderRoomsList() {
    if (roomsSnapshot.length === 0) {
      roomsListEl.innerHTML = '<span class="text-muted">No rooms yet</span>';
      return;
    }
    roomsListEl.innerHTML =
      '<div><strong>Rooms</strong></div>' +
      roomsSnapshot
        .map(
          (r) =>
            '<div>' + escapeHtml(r.name) + ' <span class="badge">' + r.count + '</span></div>'
        )
        .join('');
  }

  connectBtn.addEventListener('click', function () {
    const serverUrl = getServerUrl();
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    socket = io(serverUrl, {
      auth: getAuth(),
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socket.on('connect', function () {
      setConnected(true);
      addLogEntry({ event: 'connect', payload: { id: socket.id }, ts: Date.now(), out: false });
    });

    socket.on('disconnect', function (reason) {
      setConnected(false);
      addLogEntry({
        event: 'disconnect',
        payload: { reason },
        ts: Date.now(),
        out: false,
      });
    });

    socket.on('connect_error', function (err) {
      addLogEntry({
        event: 'connect_error',
        payload: err.message || String(err),
        ts: Date.now(),
        out: false,
      });
    });

    socket.on('playground:auth_received', function (data) {
      addLogEntry({
        event: 'auth (server received)',
        payload: data.auth,
        ts: Date.now(),
        out: false,
      });
    });

    socket.on('playground:user_count', function (data) {
      userCountEl.textContent = data.count + ' connected';
    });

    socket.on('playground:rooms', function (data) {
      roomsSnapshot = data || [];
      renderRoomsList();
    });

    socket.on('playground:echo', function (data) {
      addLogEntry({
        event: '(echo) ' + data.event,
        payload: data.args,
        ts: data.ts,
        out: true,
      });
    });

    socket.onAny(function (eventName, ...args) {
      if (
        eventName.startsWith('playground:') ||
        eventName === 'connect' ||
        eventName === 'disconnect'
      )
        return;
      addLogEntry({
        event: eventName,
        payload: args.length === 1 ? args[0] : args,
        ts: Date.now(),
        out: false,
      });
    });
  });

  disconnectBtn.addEventListener('click', function () {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    setConnected(false);
  });

  joinRoomBtn.addEventListener('click', function () {
    const room = (roomNameInput.value || '').trim() || 'default';
    if (!socket || !socket.connected) return;
    socket.emit('room:join', room, function (res) {
      if (res && res.ok) {
        myRooms.add(res.room);
        renderMyRooms();
        addLogEntry({
          event: 'room:join',
          payload: { room: res.room },
          ts: Date.now(),
          out: true,
        });
      }
    });
  });

  leaveRoomBtn.addEventListener('click', function () {
    const room = (roomNameInput.value || '').trim() || 'default';
    if (!socket || !socket.connected) return;
    socket.emit('room:leave', room, function (res) {
      if (res && res.ok) {
        myRooms.delete(res.room);
        renderMyRooms();
        addLogEntry({
          event: 'room:leave',
          payload: { room: res.room },
          ts: Date.now(),
          out: true,
        });
      }
    });
  });

  function parsePayload(str) {
    const s = (str || '').trim();
    if (!s) return undefined;
    try {
      return JSON.parse(s);
    } catch (_) {
      return s;
    }
  }

  sendBtn.addEventListener('click', function () {
    const eventName = (eventNameInput.value || '').trim();
    if (!eventName || !socket || !socket.connected) return;
    const payload = parsePayload(payloadInput.value);
    const targetType = targetTypeSelect.value;
    const targetRoom = (targetRoomInput.value || '').trim();

    const target =
      targetType === 'room' && targetRoom
        ? { type: 'room', room: targetRoom }
        : undefined;

    socket.emit('playground:emit', {
      event: eventName,
      payload: payload,
      target: target,
    });

    addLogEntry({
      event: eventName,
      payload: payload,
      ts: Date.now(),
      out: true,
    });
  });

  clearLogBtn.addEventListener('click', function () {
    eventLogEl.innerHTML = '';
  });

  pauseLogCheckbox.addEventListener('change', function () {
    logPaused = this.checked;
  });

  const templates = {
    chat: { event: 'message', payload: '{"text": "Hello from playground!", "user": "me"}' },
    ping: { event: 'ping', payload: '{}' },
    custom: { event: 'custom', payload: '{"key": "value", "n": 42}' },
  };

  templateChatBtn.addEventListener('click', function () {
    eventNameInput.value = templates.chat.event;
    payloadInput.value = templates.chat.payload;
  });
  templatePingBtn.addEventListener('click', function () {
    eventNameInput.value = templates.ping.event;
    payloadInput.value = templates.ping.payload;
  });
  templateCustomBtn.addEventListener('click', function () {
    eventNameInput.value = templates.custom.event;
    payloadInput.value = templates.custom.payload;
  });

  // Optional: connect on load if same origin
  if (window.location.port === '3000' || window.location.port === '') {
    connectBtn.click();
  }
})();
