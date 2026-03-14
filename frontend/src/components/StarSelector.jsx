import { useState } from "react";

/**
 * Interactive star rating picker
 */
export default function StarSelector({ value, onChange }) {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div
      className="star-selector"
      onMouseLeave={() => setHoverRating(0)}
    >
      {[1, 2, 3, 4, 5].map((r) => (
        <span
          key={r}
          className={`star-select ${r <= value ? "star-active" : ""} ${
            hoverRating > 0 && r <= hoverRating ? "star-hover" : ""
          }`}
          onMouseEnter={() => setHoverRating(r)}
          onClick={() => onChange(r)}
        >
          &#9733;
        </span>
      ))}
    </div>
  );
}
