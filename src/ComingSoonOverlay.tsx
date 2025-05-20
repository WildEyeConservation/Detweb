import { OverlayTrigger, Tooltip } from "react-bootstrap";

export default function ComingSoonOverlay({
  children,
}: {
  children: React.ReactElement;
}) {
  return (
    <OverlayTrigger
      placement="top"
      overlay={
        <Tooltip>
          This feature is coming soon!
        </Tooltip>
      }
      trigger={["hover", "focus"]}
    >
      {children}
    </OverlayTrigger>
  );
}
