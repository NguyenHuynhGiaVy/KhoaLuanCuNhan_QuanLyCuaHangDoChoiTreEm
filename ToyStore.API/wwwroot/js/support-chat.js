(() => {
  const button = document.createElement('button');
  button.className = 'support-chat-launcher';
  button.type = 'button';
  button.textContent = 'Chat hỗ trợ';
  button.setAttribute('aria-label', 'Mở chat hỗ trợ');

  const returnButton = document.createElement('button');
  returnButton.className = 'support-return-launcher';
  returnButton.type = 'button';
  returnButton.textContent = 'Yêu cầu trả hàng';

  const panel = document.createElement('section');
  panel.className = 'support-chat-panel';
  panel.hidden = true;
  panel.innerHTML = `
    <header class="support-chat-header">
      <div><strong>Hỗ trợ ToyStore</strong><small id="supportChatState">Đang kết nối quản lý</small></div>
      <button type="button" class="support-chat-close" aria-label="Đóng chat">×</button>
    </header>
    <div class="support-chat-history" id="supportChatHistory"></div>
    <div class="support-chat-messages" id="supportChatMessages" aria-live="polite"></div>
    <form class="support-chat-form" id="supportChatForm">
      <textarea id="supportChatInput" maxlength="4000" rows="2" placeholder="Nhập tin nhắn..." required></textarea>
      <button type="submit">Gửi</button>
    </form>`;
  const returnPanel = document.createElement('section');
  returnPanel.className = 'support-return-panel';
  returnPanel.hidden = true;
  returnPanel.innerHTML = `
    <header class="support-chat-header">
      <div><strong>Yêu cầu trả hàng</strong><small>Chỉ áp dụng với đơn đã hoàn tất</small></div>
      <button type="button" class="support-chat-close" aria-label="Đóng">×</button>
    </header>
    <div class="support-return-content" id="supportReturnContent">Đang tải đơn hàng...</div>`;
  document.body.append(button, returnButton, panel, returnPanel);

  let conversationId = null;
  let connection = null;
  let refreshTimer = null;
  let loading = false;
  let conversationStatus = 0;
  const seen = new Set();
  const token = () => localStorage.getItem('toyStoreToken') || '';
  const messagesEl = panel.querySelector('#supportChatMessages');
  const stateEl = panel.querySelector('#supportChatState');
  const input = panel.querySelector('#supportChatInput');
  const sendButton = panel.querySelector('form button');

  async function returnRequest(path, options = {}) {
    const response = await fetch(`/api${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token()}`,
        ...(options.headers || {})
      }
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || `Lỗi yêu cầu (${response.status})`);
    }
    return response.status === 204 ? null : response.json();
  }

  let customerOrders = [];
  let catalogProducts = [];
  let priorReturns = [];

  function productForVariant(variantId) {
    for (const product of catalogProducts) {
      const variant = (product.productVariants || product.variants || [])
        .find(item => Number(item.variantId || item.id) === Number(variantId));
      if (variant) return { product, variant };
    }
    return null;
  }

  function renderReturnForm() {
    const content = returnPanel.querySelector('#supportReturnContent');
    const completedOrders = customerOrders.filter(order => Number(order.status) === 4);
    content.innerHTML = `
      <form id="supportReturnForm">
        <label>Đơn hàng đã hoàn tất<select id="supportReturnOrder" required>
          <option value="">-- Chọn đơn hàng --</option>
          ${completedOrders.map(order => `<option value="${order.orderId}">${escapeHtml(order.orderCode)} · ${new Date(order.orderDate).toLocaleDateString('vi-VN')}</option>`).join('')}
        </select></label>
        <div id="supportReturnItems" class="support-return-items"><small>Chọn đơn hàng để xem sản phẩm.</small></div>
        <label>Lý do<select id="supportReturnReason">
          <option value="0">Sản phẩm lỗi / hư hỏng</option>
          <option value="1">Giao sai sản phẩm</option>
          <option value="2">Không còn nhu cầu</option>
          <option value="3">Lý do khác</option>
        </select></label>
        <label>Mô tả<textarea id="supportReturnDescription" maxlength="2000" rows="3" placeholder="Mô tả tình trạng sản phẩm..." required></textarea></label>
        <button class="support-return-submit" type="submit" ${completedOrders.length ? '' : 'disabled'}>Gửi yêu cầu trả hàng</button>
      </form>
      <div class="support-return-history"><strong>Yêu cầu đã gửi</strong>
        ${priorReturns.length ? priorReturns.map(item => {
          const labels = ['Mới yêu cầu', 'Đã duyệt · Chờ nhận hàng', 'Từ chối', 'Đã nhận hàng', 'Đã hủy'];
          return `<article><b>${escapeHtml(item.returnCode)}</b><small>${escapeHtml(labels[Number(item.status)] || 'Không xác định')} · ${new Date(item.requestedAt).toLocaleDateString('vi-VN')}</small></article>`;
        }).join('') : '<small>Chưa có yêu cầu trả hàng.</small>'}
      </div>`;

    const orderSelect = content.querySelector('#supportReturnOrder');
    orderSelect.addEventListener('change', () => {
      const order = completedOrders.find(item => Number(item.orderId) === Number(orderSelect.value));
      const productLines = new Map();
      (order?.orderDetails || []).forEach(line => {
        const current = productLines.get(line.variantId);
        if (current) current.quantity += Number(line.quantity);
        else productLines.set(line.variantId, { variantId: Number(line.variantId), quantity: Number(line.quantity) });
      });
      content.querySelector('#supportReturnItems').innerHTML = productLines.size
        ? Array.from(productLines.values()).map(item => {
          const match = productForVariant(item.variantId);
          const label = match ? `${match.product.name} · ${match.variant.sku}` : `Biến thể #${item.variantId}`;
          return `<label class="support-return-product"><input type="checkbox" data-return-variant="${item.variantId}"><span>${escapeHtml(label)}<small>Đã mua: ${item.quantity}</small></span><input type="number" min="1" max="${item.quantity}" value="1" data-return-quantity="${item.variantId}"></label>`;
        }).join('')
        : '<small>Không có sản phẩm để trả trong đơn này.</small>';
    });

    content.querySelector('#supportReturnForm').addEventListener('submit', async event => {
      event.preventDefault();
      const orderId = Number(orderSelect.value);
      const details = Array.from(content.querySelectorAll('[data-return-variant]:checked')).map(checkbox => ({
        variantId: Number(checkbox.dataset.returnVariant),
        quantity: Number(content.querySelector(`[data-return-quantity="${checkbox.dataset.returnVariant}"]`)?.value),
        unitPrice: 0,
        refundAmount: 0,
        reason: content.querySelector('#supportReturnDescription').value.trim()
      }));
      if (!details.length || details.some(item => !Number.isInteger(item.quantity) || item.quantity <= 0)) {
        content.querySelector('#supportReturnItems').insertAdjacentHTML('beforeend', '<small class="support-return-error">Chọn ít nhất một sản phẩm và số lượng hợp lệ.</small>');
        return;
      }
      try {
        await returnRequest('/ReturnRequest', {
          method: 'POST',
          body: JSON.stringify({
            orderId,
            returnType: 0,
            reason: Number(content.querySelector('#supportReturnReason').value),
            description: content.querySelector('#supportReturnDescription').value.trim(),
            details
          })
        });
        priorReturns = await returnRequest('/ReturnRequest/mine');
        renderReturnForm();
      } catch (error) {
        content.querySelector('#supportReturnItems').insertAdjacentHTML('beforeend', `<small class="support-return-error">${escapeHtml(error.message)}</small>`);
      }
    });
  }

  async function openReturnForm() {
    panel.hidden = true;
    returnPanel.hidden = false;
    const content = returnPanel.querySelector('#supportReturnContent');
    if (!token()) {
      content.textContent = 'Vui lòng đăng nhập để gửi yêu cầu trả hàng.';
      return;
    }
    try {
      const [orders, products, returns] = await Promise.all([
        returnRequest('/Order/mine'),
        fetch('/api/Product').then(response => response.ok ? response.json() : Promise.reject(new Error('Không thể tải sản phẩm.'))),
        returnRequest('/ReturnRequest/mine')
      ]);
      customerOrders = orders || [];
      catalogProducts = products || [];
      priorReturns = returns || [];
      renderReturnForm();
    } catch (error) {
      content.textContent = error.message;
    }
  }

  async function request(path, options = {}) {
    const response = await fetch(`/api/SupportChat${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token()}`,
        ...(options.headers || {})
      }
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || `Lỗi chat (${response.status})`);
    }
    return response.status === 204 ? null : response.json();
  }

  function addMessage(message) {
    if (seen.has(message.supportMessageId)) {
      const existing = messagesEl.querySelector(`[data-message-id="${message.supportMessageId}"] small`);
      if (existing && message.readAt && message.senderRole === 'Customer')
        existing.textContent = `Bạn · ${new Date(message.sentAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · Đã xem`;
      return;
    }
    seen.add(message.supportMessageId);
    const row = document.createElement('article');
    row.className = `support-chat-message ${message.senderRole === 'Customer' ? 'mine' : 'theirs'}`;
    row.dataset.messageId = message.supportMessageId;
    const text = document.createElement('p');
    text.textContent = message.content;
    const meta = document.createElement('small');
    const sentAt = new Date(message.sentAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    meta.textContent = `${message.senderRole === 'Customer' ? 'Bạn' : 'Quản lý'} · ${sentAt}${message.senderRole === 'Customer' ? (message.readAt ? ' · Đã xem' : ' · Đã gửi') : ''}`;
    row.append(text, meta);
    messagesEl.append(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function loadMessages() {
    if (!conversationId || loading) return;
    loading = true;
    try {
      const messages = await request(`/${conversationId}/messages`);
      messages.forEach(addMessage);
      await request(`/${conversationId}/read`, { method: 'POST' });
    } catch (error) {
      stateEl.textContent = error.message;
    } finally {
      loading = false;
    }
  }

  async function connectRealtime() {
    if (!window.signalR || connection) return;
    connection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/support-chat', { accessTokenFactory: token })
      .withAutomaticReconnect()
      .build();
    connection.on('SupportMessageReceived', message => {
      if (message.supportConversationId !== conversationId) return;
      addMessage(message);
      if (message.senderRole !== 'Customer') {
        request(`/${conversationId}/read`, { method: 'POST' }).catch(() => {});
      }
    });
    connection.on('SupportMessagesRead', () => loadMessages());
    connection.on('SupportConversationUpdated', conversation => {
      if (Number(conversation.supportConversationId) !== conversationId) return;
      conversationStatus = Number(conversation.status);
      stateEl.textContent = conversationStatus === 0 ? 'Đang mở' : 'Đã đóng';
      input.disabled = sendButton.disabled = conversationStatus !== 0;
    });
    connection.onreconnected(async () => {
      if (conversationId) await connection.invoke('JoinConversation', conversationId);
      await loadMessages();
    });
    try {
      await connection.start();
      if (conversationId) await connection.invoke('JoinConversation', conversationId);
      stateEl.textContent = 'Đang kết nối quản lý';
    } catch {
      connection = null;
      stateEl.textContent = 'Đang chờ kết nối';
    }
  }

  function renderConversationHistory(conversations) {
    const history = panel.querySelector('#supportChatHistory');
    history.replaceChildren();
    conversations.filter(item => Number(item.supportConversationId) !== conversationId)
      .forEach(item => {
        const historyButton = document.createElement('button');
        historyButton.type = 'button';
        historyButton.textContent = `${item.status === 0 ? 'Đang mở' : 'Đã đóng'} · ${new Date(item.lastMessageAt || item.createdAt).toLocaleDateString('vi-VN')}`;
        historyButton.addEventListener('click', () => selectConversation(
          item.supportConversationId, Number(item.status)));
        history.append(historyButton);
      });
  }

  async function selectConversation(id, status) {
    conversationId = Number(id);
    conversationStatus = Number(status);
    seen.clear();
    messagesEl.replaceChildren();
    stateEl.textContent = conversationStatus === 0 ? 'Đang mở' : 'Đã đóng';
    input.disabled = sendButton.disabled = conversationStatus !== 0;
    await loadMessages();
    await connectRealtime();
    if (window.signalR && connection?.state === signalR.HubConnectionState.Connected)
      await connection.invoke('JoinConversation', conversationId);
    const conversations = await request('/mine');
    renderConversationHistory(conversations || []);
  }

  async function openChat() {
    returnPanel.hidden = true;
    panel.hidden = false;
    if (!token()) {
      stateEl.textContent = 'Vui lòng đăng nhập để sử dụng chat';
      input.disabled = true;
      sendButton.disabled = true;
      messagesEl.textContent = 'Hãy đăng nhập tài khoản khách hàng để gửi tin nhắn hỗ trợ.';
      return;
    }
    input.disabled = false;
    sendButton.disabled = false;
    try {
      const conversation = await request('/mine', { method: 'POST', body: '{}' });
      await selectConversation(conversation.supportConversationId, conversation.status);
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = setInterval(loadMessages, 5000);
      input.focus();
    } catch (error) {
      stateEl.textContent = error.message;
    }
  }

  button.addEventListener('click', openChat);
  returnButton.addEventListener('click', openReturnForm);
  returnPanel.querySelector('.support-chat-close').addEventListener('click', () => { returnPanel.hidden = true; });
  panel.querySelector('.support-chat-close').addEventListener('click', () => { panel.hidden = true; });
  panel.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault();
    const content = input.value.trim();
    if (!content || !conversationId) return;
    sendButton.disabled = true;
    try {
      const message = await request(`/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content })
      });
      addMessage(message);
      input.value = '';
    } catch (error) {
      stateEl.textContent = error.message;
    } finally {
      sendButton.disabled = false;
    }
  });

  window.addEventListener('beforeunload', () => {
    if (refreshTimer) clearInterval(refreshTimer);
    if (connection) connection.stop();
  });
})();
