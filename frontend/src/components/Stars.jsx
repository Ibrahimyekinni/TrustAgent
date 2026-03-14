/**
 * Display-only star rating
 */
export default function Stars({ rating, size = "md" }) {
  const sizeClass = size === "lg" ? "stars-large" : "review-stars";
  return (
    <div className={sizeClass}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < rating ? "star-filled" : "star-empty"}>
          &#9733;
        </span>
      ))}
    </div>
  );
}
