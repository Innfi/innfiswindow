import { useGetNamespaceList } from "./api";

export function NamespaceListPage() {
  const { data, isFetched } = useGetNamespaceList();

  console.log(`data: ${JSON.stringify(data)}`);

  return (
    <div>
      start from here
    </div>
  );
}