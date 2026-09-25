import Button from '@/components/Button';

/**
 * In place of an empty list that has not loaded.
 *
 * "No existing plans" or a blank tip board before anything has come back --
 * or after the request failed -- reads as a fact about the trip when it is a
 * fact about the connection. The Refresh here is in the page, where a thumb
 * reaches it, rather than only in the header.
 */
export default function NotLoaded({
  what,
  onRefresh,
}: {
  what: string;
  onRefresh: () => void;
}) {
  return (
    <div role="status" className="my-3 text-center text-sm text-gray-600">
      <p className="my-0">{what} have not loaded yet.</p>
      <div className="mt-2">
        <Button type="small" onClick={onRefresh}>
          Try again
        </Button>
      </div>
    </div>
  );
}
