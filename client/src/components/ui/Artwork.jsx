export default function Artwork({ src, alt, size }) {
  const style = size ? { width: size, height: size } : undefined;
  if (!src) {
    return (
      <div className="artwork" style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
        🎙️
      </div>
    );
  }
  return <img className="artwork" style={style} src={src} alt={alt || ''} loading="lazy" />;
}
