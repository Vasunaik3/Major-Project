import { useCallback, useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import ProtectedImage from '../components/ProtectedImage.jsx';
import { apiRequest } from '../services/api.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MODEL_UNAVAILABLE_MESSAGE =
  'AI analysis will be enabled after dataset collection and model training.';

function formatBytes(bytes) {
  if (!bytes) return '—';
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function statusLabel(status) {
  return (status || 'MODEL_NOT_AVAILABLE').replaceAll('_', ' ');
}

function ImageStatus({ status }) {
  const s = status || 'MODEL_NOT_AVAILABLE';
  return (
    <span className={`image-status image-status--${s.toLowerCase().replaceAll('_', '-')}`}>
      {statusLabel(s)}
    </span>
  );
}

export default function OnionAnalysisPage() {
  const [file,           setFile]           = useState(null);
  const [previewUrl,     setPreviewUrl]     = useState('');
  const [history,        setHistory]        = useState([]);
  const [selectedImage,  setSelectedImage]  = useState(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [uploading,      setUploading]      = useState(false);
  const [error,          setError]          = useState('');
  const [notice,         setNotice]         = useState('');

  /* preview URL lifecycle (unchanged) */
  useEffect(() => {
    setPreviewUrl('');
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  /* history polling (unchanged) */
  const loadHistory = useCallback(async () => {
    try {
      const result = await apiRequest('/images?limit=100');
      setHistory(result.images || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
    const id = window.setInterval(loadHistory, 15_000);
    return () => window.clearInterval(id);
  }, [loadHistory]);

  /* selected-image refresh when PENDING/PROCESSING (unchanged) */
  useEffect(() => {
    if (!selectedImage?._id ||
        !['PENDING', 'PROCESSING'].includes(selectedImage.analysisStatus)) return undefined;
    let active = true;
    const refresh = async () => {
      try {
        const result = await apiRequest(`/images/${selectedImage._id}`);
        if (active) { setSelectedImage(result.image); setNotice(result.message || ''); }
      } catch { /* keep current record visible */ }
    };
    const id = window.setInterval(refresh, 5000);
    return () => { active = false; window.clearInterval(id); };
  }, [selectedImage?._id, selectedImage?.analysisStatus]);

  /* file validation (unchanged) */
  const chooseFile = (nextFile) => {
    setError(''); setNotice(''); setSelectedImage(null);
    if (!nextFile) { setFile(null); return; }
    if (!SUPPORTED_TYPES.includes(nextFile.type)) {
      setFile(null); setError('Choose a JPEG, PNG, or WebP image.'); return;
    }
    if (nextFile.size === 0 || nextFile.size > MAX_IMAGE_BYTES) {
      setFile(null);
      setError(nextFile.size === 0
        ? 'The selected file is empty.'
        : 'Image must be 5 MB or smaller.');
      return;
    }
    setFile(nextFile);
  };

  /* upload (unchanged) */
  const upload = async (e) => {
    e.preventDefault();
    if (!file || uploading) return;
    setUploading(true); setError(''); setNotice('');
    const fd = new FormData();
    fd.append('image', file);
    try {
      const result = await apiRequest('/images', { method: 'POST', body: fd });
      setSelectedImage(result.image);
      setNotice(result.message || MODEL_UNAVAILABLE_MESSAGE);
      setFile(null);
      await loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  /* inspect (unchanged) */
  const inspectImage = async (id) => {
    setError('');
    try {
      const result = await apiRequest(`/images/${id}`);
      setSelectedImage(result.image);
      setNotice(result.message || MODEL_UNAVAILABLE_MESSAGE);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="onion-analysis-page">
      {/* Page header */}
      <section className="page-intro analysis-page-intro">
        <div>
          <div className="eyebrow">IMAGE WORKSPACE <span className="eyebrow-line" /></div>
          <h1>Onion image analysis</h1>
          <p>Upload and manage onion images. AI analysis will be enabled after dataset collection and model training.</p>
        </div>
        <span className="analysis-model-tag">
          <span className="status-dot status-dot--muted" />
          MODEL NOT AVAILABLE
        </span>
      </section>

      {/* Disclaimer */}
      <div className="analysis-disclaimer" role="note">
        <div className="analysis-disclaimer-icon"><Icon name="info" size={18} /></div>
        <div>
          <strong>{MODEL_UNAVAILABLE_MESSAGE}</strong>
          <p>Images are stored locally and tracked in the upload history. No onion classification or confidence score is generated.</p>
        </div>
      </div>

      {/* Banners */}
      {error && (
        <div className="analysis-error" role="alert">
          <Icon name="warning" size={15} />
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Dismiss">
            <Icon name="x" size={15} />
          </button>
        </div>
      )}
      {notice && (
        <div className="analysis-notice" role="status">
          <Icon name="check" size={15} />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss">
            <Icon name="x" size={15} />
          </button>
        </div>
      )}

      {/* Upload + Detail grid */}
      <div className="analysis-main-grid">
        {/* Upload panel */}
        <section className="panel analysis-upload-panel">
          <div className="panel-heading">
            <div>
              <h2>Upload an image</h2>
              <p>Supported formats: JPEG, PNG, WebP · Up to 5 MB</p>
            </div>
            <span className="analysis-step-tag">IMAGE INTAKE</span>
          </div>

          <form onSubmit={upload}>
            <label
              className={`analysis-drop-area${previewUrl ? ' has-preview' : ''}`}
              htmlFor="analysis-image-file"
            >
              {previewUrl
                ? <img src={previewUrl} className="analysis-preview" alt="Preview of selected onion image" />
                : (
                  <span className="analysis-upload-icon">
                    <Icon name="upload" size={24} />
                  </span>
                )}
              <strong>{file?.name || 'Select an onion image'}</strong>
              <span>
                {file
                  ? `${formatBytes(file.size)} · Ready to upload`
                  : 'Click to browse or drag an image here'}
              </span>
              <input
                id="analysis-image-file"
                type="file"
                accept={SUPPORTED_TYPES.join(',')}
                onChange={(e) => { chooseFile(e.target.files?.[0]); e.target.value = ''; }}
              />
            </label>

            <div className="analysis-upload-actions">
              <button
                className="btn btn-forest analysis-upload-button"
                type="submit"
                disabled={!file || uploading}
              >
                {uploading ? 'Uploading image…' : 'Upload image'}
              </button>
              {file && (
                <button
                  className="analysis-clear-button"
                  type="button"
                  onClick={() => chooseFile(null)}
                >
                  Clear selection
                </button>
              )}
            </div>
          </form>

          <p className="analysis-upload-footnote">
            Files are validated by format, size, and content signature before local storage.
          </p>
        </section>

        {/* Detail panel */}
        <section className="panel analysis-detail-panel">
          <div className="panel-heading">
            <div>
              <h2>Image record</h2>
              <p>Upload metadata and current analysis status</p>
            </div>
            {selectedImage && <ImageStatus status={selectedImage.analysisStatus} />}
          </div>

          {selectedImage ? (
            <div className="selected-image-record">
              <ProtectedImage
                className="selected-image-preview"
                src={selectedImage.imageUrl}
                alt={selectedImage.originalName || 'Uploaded onion'}
              />
              <div className="selected-image-info">
                <strong title={selectedImage.originalName}>
                  {selectedImage.originalName || 'Onion image'}
                </strong>
                <span>Uploaded {formatDate(selectedImage.uploadedAt)}</span>
                <span>{selectedImage.mimeType || 'Image'} · {formatBytes(selectedImage.sizeBytes)}</span>
              </div>

              <div className="analysis-status-message">
                <ImageStatus status={selectedImage.analysisStatus} />
                <p>{notice || MODEL_UNAVAILABLE_MESSAGE}</p>
              </div>

              {selectedImage.predictedClass ? (
                <div className="future-prediction-fields">
                  <span>MODEL OUTPUT</span>
                  <strong>{selectedImage.predictedClass}</strong>
                  <small>
                    {typeof selectedImage.confidence === 'number'
                      ? `Confidence ${(selectedImage.confidence * 100).toFixed(1)}%`
                      : 'Confidence not supplied'}
                    {selectedImage.modelVersion ? ` · ${selectedImage.modelVersion}` : ''}
                  </small>
                </div>
              ) : (
                <div className="future-prediction-fields is-empty">
                  <span>MODEL OUTPUT FIELDS</span>
                  <strong>Not available</strong>
                  <small>
                    predictedClass, confidence, and modelVersion are reserved for a future trained model.
                  </small>
                </div>
              )}
            </div>
          ) : (
            <div className="analysis-detail-empty">
              <span className="analysis-empty-icon"><Icon name="image" size={20} /></span>
              <strong>No image selected</strong>
              <p>Upload an image or select one from your analysis history.</p>
            </div>
          )}
        </section>
      </div>

      {/* History panel */}
      <section className="panel analysis-history-panel">
        <div className="panel-heading">
          <div>
            <h2>Analysis history</h2>
            <p>Images stored in this prototype</p>
          </div>
          <span className="panel-count">{history.length} images</span>
        </div>

        {historyLoading ? (
          <div className="analysis-history-empty">Loading image history…</div>
        ) : history.length === 0 ? (
          <div className="analysis-history-empty">
            <span className="analysis-empty-icon"><Icon name="image" size={20} /></span>
            <strong>No uploads yet</strong>
            <p>Your uploaded onion images and analysis statuses will appear here.</p>
          </div>
        ) : (
          <div className="analysis-history-list">
            {history.map((image) => (
              <button
                key={image._id}
                type="button"
                className={`analysis-history-item${selectedImage?._id === image._id ? ' is-selected' : ''}`}
                onClick={() => inspectImage(image._id)}
              >
                <ProtectedImage src={image.imageUrl} alt="" loading="lazy" />
                <span className="history-image-copy">
                  <strong title={image.originalName}>{image.originalName || 'Onion image'}</strong>
                  <small>{formatDate(image.uploadedAt)} · {formatBytes(image.sizeBytes)}</small>
                </span>
                <ImageStatus status={image.analysisStatus} />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
