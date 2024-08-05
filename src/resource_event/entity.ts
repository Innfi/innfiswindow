// EventList
export interface EventList {
  kind: string;
  apiVersion: string;

  metadata: {
    continue: string;
    remainingItemCount: number;
  };

  items: EventSummary[];
}

export interface EventSummary {
  type: string;
  note: string;
  regarding: {
    kind: string;
    namespace: string;
    name: string;
    uid: string;
  };
}
