import DetailPageContent from "../../../components/detail-page-content";

export default function Page({ params }: { params: Promise<{ mediaType: string; id: string }> }) {
  return <DetailPageContent params={params} />;
}
