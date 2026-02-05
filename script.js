const EMAIL_ENDPOINT = "https://script.google.com/macros/s/AKfycbw_FUW4HxY0TSY4JJYxQRSfWiphHmhFMiJeH4Lc1o-wlPZxEltjwJcGKUCsSn5Z2lHv/exec";

const cakeImg = document.getElementById("cakeImg");

const candles = document.querySelectorAll(".candle-btn");
const modal = document.getElementById("wishModal");
const textarea = document.getElementById("modalWish");
const confirmBtn = document.getElementById("confirmWish");

const endSceneEl = document.getElementById("endScene");
const closeEndSceneBtn = document.getElementById("closeEndScene");

// các nến đã tắt thật sự (đã bấm confirm)
const offSet = new Set();

// trạng thái "đang chọn" (đã đổi ảnh nhưng CHƯA confirm)
let pendingCandle = null;
let pendingPrevKey = "0"; // để rollback nếu hủy

// ===== Helpers =====
function currentKeyFromSet(set) {
  return ["1", "2", "3"].filter(id => set.has(id)).join("") || "0";
}

function updateCakeImageByKey(key) {
  cakeImg.src = `assets/cake_${key}.png`;
}

function openModal() {
  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");
  textarea.focus();
}

function closeModal() {
  modal.classList.add("hidden");
  document.body.classList.remove("modal-open");
  textarea.value = "";
}

function showEndScene() {
  endSceneEl.classList.remove("hidden");
  endSceneEl.setAttribute("aria-hidden", "false");
}

function hideEndScene() {
  endSceneEl.classList.add("hidden");
  endSceneEl.setAttribute("aria-hidden", "true");
}

// Rollback khi người dùng hủy (click nền / Esc / nút hủy / nút X)
function rollbackPending() {
  if (!pendingCandle) return;

  // trả state về như cũ
  offSet.delete(pendingCandle.dataset.id);
  pendingCandle.classList.remove("pending");
  updateCakeImageByKey(pendingPrevKey);

  pendingCandle = null;
}

// Finalize khi bấm "Đã ước"
function finalizePending() {
  if (!pendingCandle) return;

  pendingCandle.classList.remove("pending");
  pendingCandle.classList.add("off");

  pendingCandle = null;
}

// ===== Click nến: đổi ảnh + mở modal =====
candles.forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.classList.contains("off")) return;

    // nếu đang pending cũ, rollback trước để khỏi rối state
    rollbackPending();

    // lưu key hiện tại để hoàn tác nếu hủy
    pendingPrevKey = currentKeyFromSet(offSet);

    // set pending
    pendingCandle = btn;

    // 1) thêm vào state
    offSet.add(btn.dataset.id);

    // 2) đổi ảnh ngay
    updateCakeImageByKey(currentKeyFromSet(offSet));

    // 3) đánh dấu đang chọn (pending), CHƯA off thật
    btn.classList.add("pending");

    // 4) mở modal
    openModal();
  });
});

// ===== Confirm: giữ trạng thái + gửi mail + đủ 3 thì show end scene =====
confirmBtn.addEventListener("click", () => {
  // guard an toàn
  if (!pendingCandle) return;

  const wish = textarea.value.trim();
  if (!wish) return;

  // Lưu lại 3 điều ước trong session (hoặc localStorage nếu bạn muốn giữ lâu)
  window.__WISHES__ = window.__WISHES__ || [];
  window.__WISHES__.push({ text: wish });

  // finalize + đóng modal
  finalizePending();
  closeModal();

  // nếu có launchKite() thì vẫn chạy
  if (typeof window.launchKite === "function") window.launchKite();

  // nếu đủ 3 điều ước thì gửi 1 email tổng + show end scene
  if (offSet.size === 3) {
    sendWishesEmail(window.__WISHES__).catch(console.error);
    setTimeout(showEndScene, 1200);
  }
});

// ===== Cancel: click nền modal =====
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    closeModal();
    rollbackPending();
  }
});

// ===== Cancel: Esc =====
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.classList.contains("hidden")) {
    closeModal();
    rollbackPending();
  }
});

// ===== Nút X + nút “Suy nghĩ lại...” =====
document.getElementById("closeModal")?.addEventListener("click", () => {
  closeModal();
  rollbackPending();
});

document.getElementById("cancelWish")?.addEventListener("click", () => {
  closeModal();
  rollbackPending();
});

// ===== Đóng End Scene =====
closeEndSceneBtn?.addEventListener("click", hideEndScene);

// ===== Gửi email tổng 3 điều ước =====
async function sendWishesEmail(wishes) {
  if (!EMAIL_ENDPOINT || EMAIL_ENDPOINT.includes("/XXXX/")) return;

  if (sessionStorage.getItem("email_sent") === "1") return;
  sessionStorage.setItem("email_sent", "1");

  const text = wishes
    .map((w, i) => `Điều ước ${i + 1}: ${w.text}`)
    .join("\n");

  try {
    await fetch(EMAIL_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body:
        "page=" + encodeURIComponent(location.href) +
        "&wishes=" + encodeURIComponent(text),
    });
  } catch (e) {
    console.error("Send mail failed", e);
  }
}

