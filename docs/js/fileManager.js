export const MAX_SIZE_BYTES = 300 * 1024 * 1024; // 300 MB
let selectedFiles = [];

export function addFiles(newFiles) {
    const currentTotalSize = getTotalSize();
    let sizeToAdd = 0;
    const validFiles = [];

    for (let file of newFiles) {
        const isDuplicate = selectedFiles.some(f => f.name === file.name && f.size === file.size);
        if (isDuplicate) continue;
        if (currentTotalSize + sizeToAdd + file.size > MAX_SIZE_BYTES) {
            alert('Cannot add files. 300MB limit exceeded.');
            break;
        }
        sizeToAdd += file.size;
        validFiles.push(file);
    }
    selectedFiles = [...selectedFiles, ...validFiles];
    return selectedFiles;
}

export function removeFile(index) {
    selectedFiles.splice(index, 1);
    return selectedFiles;
}

export function getFiles() { return selectedFiles; }
export function getTotalSize() { return selectedFiles.reduce((acc, file) => acc + file.size, 0); }

// NEW: Clear file array on reset
export function clearAllFiles() {
    selectedFiles = [];
}

export function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export async function getTransferableData() {
    if (selectedFiles.length === 0) return null;
    if (selectedFiles.length === 1) return selectedFiles[0]; 

    const zip = new JSZip();
    selectedFiles.forEach(file => zip.file(file.name, file));
    const content = await zip.generateAsync({ type: "blob" });
    return new File([content], "ShareFiles_Transfer.zip", { type: "application/zip" });
}