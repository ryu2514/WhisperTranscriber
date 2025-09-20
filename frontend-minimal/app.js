// ミニマルなWhisperTranscriber JavaScript
class WhisperTranscriber {
    constructor() {
        this.apiBaseUrl = 'https://whisper-transcriber-api-jjth.onrender.com/api';
        this.currentUploadId = null;
        this.currentTranscriptionId = null;
        this.pollInterval = null;

        this.initializeElements();
        this.attachEventListeners();
    }

    initializeElements() {
        this.fileInput = document.getElementById('audioFile');
        this.fileInfo = document.getElementById('fileInfo');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.statusSection = document.getElementById('statusSection');
        this.resultSection = document.getElementById('resultSection');
        this.errorSection = document.getElementById('errorSection');
        this.progress = document.getElementById('progress');
        this.statusText = document.getElementById('statusText');
        this.resultText = document.getElementById('resultText');
        this.downloadTxt = document.getElementById('downloadTxt');
        this.copyText = document.getElementById('copyText');
        this.retryBtn = document.getElementById('retryBtn');
        this.timestampsCheckbox = document.getElementById('timestamps');
    }

    attachEventListeners() {
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.uploadBtn.addEventListener('click', () => this.startTranscription());
        this.downloadTxt.addEventListener('click', () => this.downloadResult());
        this.copyText.addEventListener('click', () => this.copyToClipboard());
        this.retryBtn.addEventListener('click', () => this.resetApp());
    }

    handleFileSelect(event) {
        const file = event.target.files[0];

        if (!file) {
            this.fileInfo.textContent = '';
            this.uploadBtn.disabled = true;
            return;
        }

        // ファイル情報を表示
        const fileSize = (file.size / 1024 / 1024).toFixed(2);
        this.fileInfo.textContent = `選択されたファイル: ${file.name} (${fileSize} MB)`;

        // ファイルサイズチェック（500MB制限）
        if (file.size > 500 * 1024 * 1024) {
            this.showError('ファイルサイズが500MBを超えています。より小さなファイルを選択してください。');
            this.uploadBtn.disabled = true;
            return;
        }

        this.uploadBtn.disabled = false;
    }

    async startTranscription() {
        const file = this.fileInput.files[0];
        if (!file) {
            this.showError('ファイルが選択されていません。');
            return;
        }

        try {
            this.hideAllSections();
            this.showStatus('ファイルをアップロード中...', 10);

            // ファイルアップロード
            const uploadResult = await this.uploadFile(file);
            if (!uploadResult.success) {
                throw new Error(uploadResult.error || 'アップロードに失敗しました');
            }

            this.currentUploadId = uploadResult.data.uploadId;
            this.showStatus('転写を開始中...', 30);

            // 転写開始
            const transcriptionResult = await this.startTranscriptionProcess();
            if (!transcriptionResult.success) {
                throw new Error(transcriptionResult.error || '転写開始に失敗しました');
            }

            this.currentTranscriptionId = transcriptionResult.data.transcriptionId;
            this.showStatus('転写処理中...', 50);

            // ポーリングで進捗監視
            this.startPolling();

        } catch (error) {
            console.error('Error:', error);
            this.showError(error.message);
        }
    }

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('audio', file);
        formData.append('options', JSON.stringify({
            language: 'ja',
            includeTimestamps: this.timestampsCheckbox.checked
        }));

        const response = await fetch(`${this.apiBaseUrl}/upload`, {
            method: 'POST',
            body: formData
        });

        return await response.json();
    }

    async startTranscriptionProcess() {
        const response = await fetch(`${this.apiBaseUrl}/transcribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uploadId: this.currentUploadId
            })
        });

        return await response.json();
    }

    startPolling() {
        this.pollInterval = setInterval(async () => {
            try {
                const status = await this.checkTranscriptionStatus();

                if (status.data.status === 'completed') {
                    clearInterval(this.pollInterval);
                    this.showStatus('転写完了！結果を取得中...', 90);
                    await this.getTranscriptionResult();
                } else if (status.data.status === 'failed') {
                    clearInterval(this.pollInterval);
                    throw new Error(status.data.error || '転写処理に失敗しました');
                } else {
                    // 処理中
                    const progress = Math.min(80, 50 + (status.data.progress || 0) * 30 / 100);
                    this.showStatus('転写処理中...', progress);
                }
            } catch (error) {
                clearInterval(this.pollInterval);
                this.showError(error.message);
            }
        }, 3000); // 3秒ごとにチェック
    }

    async checkTranscriptionStatus() {
        const response = await fetch(`${this.apiBaseUrl}/transcribe/${this.currentTranscriptionId}/status`);
        return await response.json();
    }

    async getTranscriptionResult() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/transcribe/${this.currentTranscriptionId}/result`);
            const result = await response.json();

            if (result.success) {
                this.showResult(result.data.text);
            } else {
                throw new Error(result.error || '結果の取得に失敗しました');
            }
        } catch (error) {
            this.showError(error.message);
        }
    }

    showStatus(message, progressPercent) {
        this.hideAllSections();
        this.statusSection.style.display = 'block';
        this.statusSection.classList.add('fade-in');
        this.statusText.textContent = message;
        this.progress.style.width = `${progressPercent}%`;
    }

    showResult(text) {
        this.hideAllSections();
        this.resultSection.style.display = 'block';
        this.resultSection.classList.add('fade-in');
        this.resultText.value = text;
    }

    showError(message) {
        this.hideAllSections();
        this.errorSection.style.display = 'block';
        this.errorSection.classList.add('fade-in');
        document.getElementById('errorText').textContent = message;

        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
    }

    hideAllSections() {
        this.statusSection.style.display = 'none';
        this.resultSection.style.display = 'none';
        this.errorSection.style.display = 'none';

        // アニメーションクラスをリセット
        [this.statusSection, this.resultSection, this.errorSection].forEach(section => {
            section.classList.remove('fade-in');
        });
    }

    downloadResult() {
        const text = this.resultText.value;
        if (!text) return;

        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transcription_${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async copyToClipboard() {
        const text = this.resultText.value;
        if (!text) return;

        try {
            await navigator.clipboard.writeText(text);
            // 一時的にボタンテキストを変更
            const originalText = this.copyText.textContent;
            this.copyText.textContent = '✅ コピー完了！';
            setTimeout(() => {
                this.copyText.textContent = originalText;
            }, 2000);
        } catch (error) {
            console.error('クリップボードへのコピーに失敗:', error);
            // フォールバック: テキストエリアを選択
            this.resultText.select();
            document.execCommand('copy');
            this.copyText.textContent = '✅ コピー完了！';
            setTimeout(() => {
                this.copyText.textContent = '📋 クリップボードにコピー';
            }, 2000);
        }
    }

    resetApp() {
        // 状態リセット
        this.currentUploadId = null;
        this.currentTranscriptionId = null;

        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }

        // UI リセット
        this.fileInput.value = '';
        this.fileInfo.textContent = '';
        this.uploadBtn.disabled = true;
        this.hideAllSections();
    }
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    new WhisperTranscriber();
});