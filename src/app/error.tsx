"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div>
      <h2>Что-то пошло не так!</h2>
      <button onClick={() => reset()}>Попробовать снова</button>
    </div>
  );
}
