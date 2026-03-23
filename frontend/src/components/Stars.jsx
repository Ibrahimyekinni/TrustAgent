/**
 * Display-only star rating
 */
export default function Stars({ rating, size = "md" }) {
  const clamped = Math.max(0, Math.min(5, rating));
  const sizeClass = size === "lg" ? "stars-large" : "review-stars";
  return (
    <div className={sizeClass}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < clamped ? "star-filled" : "star-empty"}>
          &#9733;
        </span>
      ))}
    </div>
  );
}
