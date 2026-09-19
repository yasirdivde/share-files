import { addFiles, removeFile, getTransferableData, clearAllFiles } from './fileManager.js';
import { showScreen, renderFileList, renderWaitingScreen, startTimer, stopTimer, setupOTPInputs, setupTransferScreen, updateTransferProgress, renderCompleteScreen, toggleQRScanner, showToast, resetSenderUI, resetReceiverUI } from './ui.js';
import { initSender, initReceiver, terminateConnection, cancelTransfer, startSendingFile } from './webrtc.js';

document.addEventListener('DOMContentLoaded', () => {
    
    const btnHomeSend = document.getElementById('btn-home-send');
    const btnHomeReceive = document.getElementById('btn-home-receive');
    const btnConnectPc = document.getElementById('btn-connect-pc');
    
    const btnBackHomeFromSend = document.getElementById('btn-back-home-from-send');
    const btnBackHomeFromReceive = document.getElementById('btn-back-home-from-receive');
    const btnBackHomeFromHelp = document.getElementById('btn-back-home-from-help');
    
    const btnCancelShare = document.getElementById('btn-cancel-share');
    const btnAbortTransfer = document.getElementById('btn-abort-transfer');
    const btnBackToHome = document.getElementById('btn-back-to-home');
    
    const btnAddFiles = document.getElementById('btn-add-files');
    const fileInput = document.getElementById('file-input');
    const btnStartSharing = document.getElementById('btn-start-sharing');
    
    const btnConnectReceiver = document.getElementById('btn-connect-receiver');
    const btnScanQR = document.getElementById('btn-scan-qr');
    const btnCloseScanner = document.getElementById('btn-close-scanner');
    
    const btnDownloadFile = document.getElementById('btn-download-file');

    let preparedFile = null; 
    let currentInputCode = null;
    let transferStartTime = 0;
    let html5QrcodeScanner = null;
    let isTransferring = false;
    // FIX: single preallocated Uint8Array instead of array-of-chunks
    let receiveBuffer = null;
    let pendingDownloadBlobUrl = null;
    let pendingDownloadFilename = null;

    // UI Throttling to prevent layout thrashing
    let lastUITime = 0;
    const UI_THROTTLE_MS = 150; 

    function cleanupMemory() {
        if (pendingDownloadBlobUrl) {
            URL.revokeObjectURL(pendingDownloadBlobUrl); 
            pendingDownloadBlobUrl = null;
        }
        // FIX: release buffer reference so GC can reclaim it
        receiveBuffer = null; 
        preparedFile = null;
        currentInputCode = null;

        clearAllFiles();
        resetSenderUI();
        resetReceiverUI();
    }

    btnHomeSend.addEventListener('click', () => showScreen('screen-send'));
    btnHomeReceive.addEventListener('click', () => showScreen('screen-receive'));
    btnConnectPc.addEventListener('click', () => showScreen('screen-help'));
    
    const goHome = () => { 
        terminateConnection(); 
        isTransferring = false;
        cleanupMemory();
        showScreen('screen-home'); 
    };
    
    btnBackHomeFromSend.addEventListener('click', goHome);
    btnBackHomeFromReceive.addEventListener('click', goHome);
    btnBackHomeFromHelp.addEventListener('click', goHome);
    btnBackToHome.addEventListener('click', goHome);
    
    btnCancelShare.addEventListener('click', () => { 
        stopTimer(); 
        terminateConnection(); 
        cleanupMemory(); 
        showScreen('screen-send'); 
    });
    
    btnAbortTransfer.addEventListener('click', () => {
        if(confirm("Are you sure you want to cancel the transfer?")) { 
            cancelTransfer(); 
            showToast("You cancelled the transfer.");
            goHome(); 
        }
    });

    // ----- SENDER LOGIC -----
    btnAddFiles.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        updateUI(addFiles(Array.from(e.target.files)));
        fileInput.value = ''; 
    });

    btnStartSharing.addEventListener('click', async () => {
        const originalText = btnStartSharing.innerHTML;
        btnStartSharing.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparing...';
        btnStartSharing.setAttribute('disabled', 'true');

        try {
            preparedFile = await getTransferableData(); 
            const code = initSender(
                (connection) => { 
                    stopTimer();
                    isTransferring = true;
                    setupTransferScreen('sender', preparedFile.name, preparedFile.size);
                    showScreen('screen-transfer');
                    transferStartTime = Date.now();
                    lastUITime = transferStartTime;
                    
                    startSendingFile(preparedFile, 
                        (loaded, total) => {
                            const now = Date.now();
                            // Throttle updates unless it's the final chunk
                            if (now - lastUITime > UI_THROTTLE_MS || loaded === total) {
                                updateTransferProgress(loaded, total, transferStartTime);
                                lastUITime = now;
                            }
                        },
                        () => { 
                            isTransferring = false;
                            renderCompleteScreen('sender', preparedFile.name, preparedFile.size, false);
                            showScreen('screen-complete');
                        }
                    );
                },
                (data) => { 
                    if(data.type === 'CANCEL') {
                        showToast("Receiver cancelled the transfer.");
                        goHome();
                    }
                },
                () => {
                    if(isTransferring) {
                        showToast("Connection lost with receiver.");
                        goHome();
                    }
                }
            );
            renderWaitingScreen(code);
            showScreen('screen-waiting');
            startTimer(300, () => { showToast("Session expired."); terminateConnection(); showScreen('screen-send'); });
        } catch (err) {
            console.error(err); showToast("Error preparing files.");
        } finally {
            btnStartSharing.innerHTML = originalText; btnStartSharing.removeAttribute('disabled');
        }
    });

    function updateUI(files) { renderFileList(files, (idx) => updateUI(removeFile(idx))); }

    // ----- RECEIVER LOGIC -----
    setupOTPInputs((code) => { currentInputCode = code; });

    let expectedSize = 0;
    let expectedName = "";
    let receivedBytes = 0;

    function executeConnection(codeToConnect) {
        const originalText = btnConnectReceiver.innerHTML;
        btnConnectReceiver.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connecting...';
        btnConnectReceiver.setAttribute('disabled', 'true');

        initReceiver(codeToConnect, 
            (connection) => { 
                btnConnectReceiver.innerHTML = originalText; btnConnectReceiver.removeAttribute('disabled');
            }, 
            (error) => { 
                // FIX: clearer failure feedback so the user knows the code was wrong
                btnConnectReceiver.innerHTML = originalText; 
                btnConnectReceiver.removeAttribute('disabled');
                showToast('Invalid or expired code. Please try again.');
            },
            (data, activeConn) => { 
                
                // Intercept raw binary chunks immediately
                if (data instanceof ArrayBuffer || ArrayBuffer.isView(data) || (data.byteLength !== undefined && !data.type)) {
                    
                    // FIX: write directly into the preallocated buffer (no per-chunk allocation)
                    if (receiveBuffer) {
                        let chunk;
                        if (data instanceof Uint8Array) {
                            chunk = data; // already a view, no copy
                        } else if (data instanceof ArrayBuffer) {
                            chunk = new Uint8Array(data);
                        } else {
                            // ArrayBufferView (e.g. DataView) — wrap without copying
                            chunk = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
                        }
                        receiveBuffer.set(chunk, receivedBytes);
                        receivedBytes += chunk.byteLength;
                    }
                    
                    const now = Date.now();
                    // Throttle UI updates
                    if (now - lastUITime > UI_THROTTLE_MS || receivedBytes === expectedSize) {
                        updateTransferProgress(receivedBytes, expectedSize, transferStartTime);
                        lastUITime = now;
                    }
                    return; 
                }

                // Control Messages Fallback
                if (data.type === 'META') {
                    isTransferring = true;
                    expectedName = data.name; 
                    expectedSize = data.size;

                    // FIX: preallocate one buffer of exactly the incoming size
                    try {
                        receiveBuffer = new Uint8Array(expectedSize);
                    } catch (allocErr) {
                        console.error('Buffer allocation failed:', allocErr);
                        showToast('File too large to receive.');
                        goHome();
                        return;
                    }
                    receivedBytes = 0;
                    transferStartTime = Date.now();
                    lastUITime = transferStartTime;
                    setupTransferScreen('receiver', expectedName, expectedSize);
                    showScreen('screen-transfer');
                    
                    activeConn.send({ type: 'META_ACK' });
                } 
                else if (data.type === 'DONE') {
                    isTransferring = false;
                    
                    if (receivedBytes !== expectedSize) {
                        showToast("Transfer corrupted: Data mismatch.");
                        goHome();
                        return;
                    }
                    
                    // Let the browser natively wrap our single Uint8Array in a Blob (zero-copy in most engines)
                    const blob = new Blob([receiveBuffer], { type: 'application/octet-stream' });
                    
                    // FIX: revoke any previous URL before creating a new one
                    if (pendingDownloadBlobUrl) URL.revokeObjectURL(pendingDownloadBlobUrl);
                    pendingDownloadBlobUrl = URL.createObjectURL(blob);
                    pendingDownloadFilename = expectedName;

                    // FIX: free the big working buffer now that the Blob owns the data
                    receiveBuffer = null;
                    
                    renderCompleteScreen('receiver', expectedName, expectedSize, true);
                    showScreen('screen-complete');
                }
                else if (data.type === 'CANCEL') {
                    showToast("Sender cancelled the transfer.");
                    goHome();
                }
            },
            () => {
                if(isTransferring) {
                    showToast("Connection lost with sender.");
                    goHome();
                }
            }
        );
    }

    btnConnectReceiver.addEventListener('click', () => {
        if (!currentInputCode || currentInputCode.length !== 6) return;
        executeConnection(currentInputCode);
    });

    btnDownloadFile.addEventListener('click', () => {
        if(!pendingDownloadBlobUrl) return;
        const a = document.createElement('a');
        a.href = pendingDownloadBlobUrl;
        a.download = pendingDownloadFilename;
        document.body.appendChild(a);

        setTimeout(() => {
            a.click();
            document.body.removeChild(a);
        }, 100);
    });

    // ----- QR SCANNER LOGIC -----
    btnScanQR.addEventListener('click', () => {
        toggleQRScanner(true);
        html5QrcodeScanner = new Html5Qrcode("qr-reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        html5QrcodeScanner.start({ facingMode: "environment" }, config, (decodedText) => {
            html5QrcodeScanner.stop().then(() => {
                toggleQRScanner(false);
                if(decodedText && decodedText.length === 6) executeConnection(decodedText); 
                else showToast("Invalid QR Code Format.");
            });
        }, () => {}).catch(() => {
            showToast("Camera permission denied.");
            toggleQRScanner(false);
        });
    });

    btnCloseScanner.addEventListener('click', () => {
        if(html5QrcodeScanner) {
            html5QrcodeScanner.stop().then(() => toggleQRScanner(false)).catch(() => toggleQRScanner(false));
        } else {
            toggleQRScanner(false);
        }
    });
});