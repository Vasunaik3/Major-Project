import { useEffect, useState } from 'react';
import { fetchApiAsset } from '../services/api.js';

export default function ProtectedImage({ src, alt = '', className = '', ...imageProps }) {
  const [objectUrl, setObjectUrl] = useState('');

  useEffect(() => {
    setObjectUrl('');
    if (!src) {
      return undefined;
    }
    let active = true;
    let createdUrl = '';
    fetchApiAsset(src).then((url) => {
      if (!url.startsWith('blob:')) {
        if (active) setObjectUrl(url);
        return;
      }
      createdUrl = url;
      if (active) setObjectUrl(url);
      else URL.revokeObjectURL(url);
    }).catch(() => {
      if (active) setObjectUrl('');
    });
    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [src]);

  if (!objectUrl) return <span className={`${className} protected-image-placeholder`} aria-label="Image unavailable" />;
  return <img src={objectUrl} alt={alt} className={className} {...imageProps} />;
}
