export default function Spinner({ message = "Loading..." }) {
  return (
    <div className="loading">
      <div className="spinner">
        <div className="spinner-ring" />
        <div className="spinner-ring" />
        <div className="spinner-ring" />
      </div>
      <p>{message}</p>
    </div>
  );
}
