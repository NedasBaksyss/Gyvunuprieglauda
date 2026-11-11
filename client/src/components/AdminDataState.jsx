export default function AdminDataState({ request }) {
  if (request.loading) return <p role="status" className="loading-message">Kraunami duomenys…</p>;
  if (request.error) return <div className="form-error" role="alert"><p>{request.error}</p><button className="button" onClick={request.retry}>Bandyti dar kartą</button></div>;
  return null;
}
