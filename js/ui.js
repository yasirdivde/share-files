import { removeFile, getTotalSize, formatBytes, MAX_SIZE_BYTES } from './fileManager.js';

export function showToast(msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'bg-[#1e293b] text-white px-6 py-3 rounded-full shadow-2xl border border-gray-600 text-[14px] font-medium transform transition-all duration-300 translate-y-[-20px] opacity-0 flex items-center gap-2';
    toast.innerHTML = `<i class="fa-solid fa-circle-info text-accent-blue"></i> ${msg}`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('translate-y-[-20px]', 'opacity-0'));
    setTimeout(() => {
        toast.classList.add('translate-y-[-20px]', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

export function playSuccessSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); 
        osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.1); 
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    } catch(e) { console.log('Audio error:', e); }
}

let screenTimeouts = {};

export function showScreen(screenId) {
    const screens = ['screen-home', 'screen-send', 'screen-waiting', 'screen-receive', 'screen-transfer', 'screen-complete', 'screen-help']; 
    screens.forEach(id => {
        const el = document.getElementById(id);
        
        if (screenTimeouts[id]) {
            clearTimeout(screenTimeouts[id].op);
            clearTimeout(screenTimeouts[id].hid);
        }
        screenTimeouts[id] = {};

        if (id === screenId) {
            el.classList.remove('hidden');
            screenTimeouts[id].op = setTimeout(() => el.classList.remove('opacity-0'), 50); 
            if(id === 'screen-transfer') el.classList.add('z-30');
            else if(id === 'screen-complete') el.classList.add('z-40');
            else if(id === 'screen-waiting') el.classList.add('z-20');
            else el.classList.add('z-10');
        } else {
            el.classList.add('opacity-0');
            screenTimeouts[id].hid = setTimeout(() => el.classList.add('hidden'), 300); 
            el.classList.remove('z-10', 'z-20', 'z-30', 'z-40');
        }
    });
}

export function resetSenderUI() {
    const listContainer = document.getElementById('file-list');
    const sizeIndicator = document.getElementById('size-indicator');
    const startButton = document.getElementById('btn-start-sharing');
    const fileInput = document.getElementById('file-input');
    
    if (listContainer) listContainer.innerHTML = '';
    // Updated to show 0 B instead of 0
    if (sizeIndicator) sizeIndicator.innerHTML = `0 B / ${MAX_SIZE_BYTES / (1024 * 1024)} MB`;
    if (startButton) startButton.setAttribute('disabled', 'true');
    if (fileInput) fileInput.value = '';
}

export function resetReceiverUI() {
    const inputs = document.querySelectorAll('.otp-input');
    const btnConnect = document.getElementById('btn-connect-receiver');
    
    inputs.forEach(input => input.value = '');
    if (btnConnect) {
        btnConnect.setAttribute('disabled', 'true');
        const iconContainer = btnConnect.querySelector('div');
        if (iconContainer) {
            iconContainer.classList.remove('bg-blue-600');
            iconContainer.classList.add('bg-gray-800');
        }
    }
}

export function renderFileList(files, onRemoveCallback) {
    const listContainer = document.getElementById('file-list');
    const sizeIndicator = document.getElementById('size-indicator');
    const startButton = document.getElementById('btn-start-sharing');
    listContainer.innerHTML = ''; 
    files.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'bg-item-bg rounded-2xl p-4 flex items-center gap-4 border border-gray-800/50';
        fileItem.innerHTML = `
            <div class="w-10 h-10 rounded-lg bg-accent-blue flex items-center justify-center text-white font-bold text-[18px] flex-shrink-0">${index + 1}</div>
            <div class="flex-1 overflow-hidden"><h4 class="text-[15px] font-medium truncate text-gray-200">${file.name}</h4></div>
            <div class="flex items-center gap-4 flex-shrink-0">
                <span class="text-[13px] text-gray-400">${formatBytes(file.size)}</span>
                <button class="text-gray-400 hover:text-white transition-colors" data-index="${index}"><i class="fa-solid fa-xmark text-lg"></i></button>
            </div>
        `;
        listContainer.appendChild(fileItem);
    });
    listContainer.querySelectorAll('button[data-index]').forEach(btn => btn.addEventListener('click', (e) => onRemoveCallback(parseInt(e.currentTarget.getAttribute('data-index')))));
    
    const totalSize = getTotalSize();
    const maxSizeMB = MAX_SIZE_BYTES / (1024 * 1024);
    
    // Updated to use formatBytes correctly
    sizeIndicator.innerHTML = `${formatBytes(totalSize)} / ${maxSizeMB} MB`;
    
    if (files.length > 0) startButton.removeAttribute('disabled');
    else startButton.setAttribute('disabled', 'true');
}

export function renderWaitingScreen(code) {
    const codeContainer = document.getElementById('display-code');
    codeContainer.innerHTML = '';
    for (let char of code) {
        const span = document.createElement('span');
        span.className = 'text-[36px] font-bold text-accent-blue drop-shadow-md';
        span.innerText = char;
        codeContainer.appendChild(span);
    }
    const qrContainer = document.getElementById('qrcode');
    qrContainer.innerHTML = ''; 
    new QRCode(qrContainer, { text: code, width: 200, height: 200, colorDark : "#000000", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.H });
}

let timerInterval;
export function startTimer(durationSeconds, onExpireCallback) {
    const timerDisplay = document.getElementById('countdown-timer');
    let timer = durationSeconds;
    clearInterval(timerInterval); 
    timerInterval = setInterval(() => {
        let minutes = parseInt(timer / 60, 10);
        let seconds = parseInt(timer % 60, 10);
        timerDisplay.textContent = (minutes < 10 ? "0" + minutes : minutes) + ":" + (seconds < 10 ? "0" + seconds : seconds);
        if (--timer < 0) { clearInterval(timerInterval); onExpireCallback(); }
    }, 1000);
}
export function stopTimer() { clearInterval(timerInterval); }

export function setupOTPInputs(onCodeComplete) {
    const inputs = document.querySelectorAll('.otp-input');
    const btnConnect = document.getElementById('btn-connect-receiver');
    inputs.forEach(input => input.value = '');
    inputs.forEach((input, index) => {
        input.addEventListener('input', () => {
            input.value = input.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase(); 
            if (input.value.length === 1 && index < inputs.length - 1) inputs[index + 1].focus();
            checkIfComplete();
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && input.value === '' && index > 0) inputs[index - 1].focus();
        });
    });
    function checkIfComplete() {
        const code = Array.from(inputs).map(i => i.value).join('');
        if (code.length === 6) {
            btnConnect.removeAttribute('disabled');
            btnConnect.querySelector('div').classList.replace('bg-gray-800', 'bg-blue-600');
            onCodeComplete(code);
        } else {
            btnConnect.setAttribute('disabled', 'true');
            btnConnect.querySelector('div').classList.replace('bg-blue-600', 'bg-gray-800');
            onCodeComplete(null);
        }
    }
}

// ----- SPEED CALCULATION TRACKERS -----
let lastLoadedBytes = 0;
let lastSpeedTime = 0;
let smoothedSpeedBps = 0; // EMA Tracker

export function setupTransferScreen(role, filename, totalSize) {
    document.getElementById('transfer-title').innerText = role === 'sender' ? 'Transfer in Progress' : 'Receiving...';
    document.getElementById('transfer-subtitle').innerText = role === 'sender' ? 'Sending files...' : 'Receiving files...';
    document.getElementById('transfer-filename').innerText = filename;
    document.getElementById('transfer-size').innerText = formatBytes(totalSize);
    
    // Reset trackers for new transfer
    lastLoadedBytes = 0;
    lastSpeedTime = Date.now();
    smoothedSpeedBps = 0;

    updateTransferProgress(0, totalSize, 0); 
}

export function updateTransferProgress(loaded, total, startTime) {
    // 1. Instantly update the progress bar and percentage
    const percentage = total === 0 ? 0 : Math.min(100, Math.round((loaded / total) * 100));
    document.getElementById('transfer-progress-bar').style.width = `${percentage}%`;
    document.getElementById('transfer-percentage').innerText = `${percentage}%`;

    const now = Date.now();
    const timeDiff = now - lastSpeedTime;

    // 2. Throttle speed calculation to every 500ms (or if finished to show final state)
    if (timeDiff >= 500 || (loaded === total && timeDiff > 0)) {
        
        // Calculate raw bytes per second for this specific 500ms window
        const bytesSinceLast = Math.max(0, loaded - lastLoadedBytes);
        const currentSpeedBps = (bytesSinceLast / timeDiff) * 1000; 

        // 3. Apply Exponential Moving Average (EMA)
        const alpha = 0.35;
        smoothedSpeedBps = smoothedSpeedBps === 0 
            ? currentSpeedBps 
            : smoothedSpeedBps * (1 - alpha) + currentSpeedBps * alpha;

        // Update Speed UI
        document.getElementById('transfer-speed').innerText = `${(smoothedSpeedBps / (1024 * 1024)).toFixed(2)} MB/s`;

        // Update ETA UI based on the EMA speed
        const remainingBytes = total - loaded;
        const etaSeconds = smoothedSpeedBps > 0 ? Math.round(remainingBytes / smoothedSpeedBps) : 0;
        document.getElementById('transfer-eta').innerText = formatETA(etaSeconds);

        // Update trackers for the next tick
        lastLoadedBytes = loaded;
        lastSpeedTime = now;
    }
}

export function renderCompleteScreen(role, filename, totalSize, showDownload = false) {
    document.getElementById('complete-subtitle').innerText = role === 'sender' ? 'Your file has been sent successfully.' : 'Your file has been received successfully.';
    document.getElementById('complete-filename').innerText = filename;
    document.getElementById('complete-size').innerText = formatBytes(totalSize);
    
    const downloadBtn = document.getElementById('btn-download-file');
    if (showDownload) downloadBtn.classList.remove('hidden');
    else downloadBtn.classList.add('hidden');
    
    playSuccessSound();
}

function formatETA(seconds) {
    if (!isFinite(seconds)) return "--:--";
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

export function toggleQRScanner(show) {
    const modal = document.getElementById('modal-qr-scanner');
    if(show) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    } else {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}
