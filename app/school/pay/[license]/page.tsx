import SchoolPayClient from "./SchoolPayClient";

export default async function SchoolPayPage({ params }: { params: Promise<{ license: string }> }) {
  const { license } = await params;
  return <SchoolPayClient licenseId={license} />;
}
