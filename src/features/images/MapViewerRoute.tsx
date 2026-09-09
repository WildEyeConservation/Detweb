import { useQuery } from '@tanstack/react-query';
import { client } from '../../shared/api/appClient';
import ImageViewerModal from './ImageViewerModal';
import AnnotationViewerModal from '../annotation/AnnotationViewerModal';
import DialogNotice from '../../shared/routing/DialogNotice';

export default function MapViewerRoute(props: {
  editable?: boolean;
  imageId: string | null;
  imageIds: string[];
  annotationSetId: string;
  categoryIds: string[];
  onClose: () => void;
  onNavigate: (id: string) => void;
}) {
  const { imageId, annotationSetId, onClose } = props;
  const image = useQuery({
    queryKey: ['viewerImage', imageId],
    enabled: Boolean(imageId),
    staleTime: 30_000,
    queryFn: async () =>
      (
        await client.models.Image.get(
          { id: imageId! },
          { selectionSet: ['id', 'projectId', 'width', 'height'] }
        )
      ).data,
  });
  const set = useQuery({
    queryKey: ['viewerAnnotationSet', annotationSetId],
    enabled: Boolean(annotationSetId),
    staleTime: 30_000,
    queryFn: async () =>
      (
        await client.models.AnnotationSet.get(
          { id: annotationSetId },
          { selectionSet: ['id', 'projectId'] }
        )
      ).data,
  });
  if (!imageId || !annotationSetId)
    return (
      <DialogNotice
        message='This viewer link is missing an image or annotation set.'
        onClose={onClose}
      />
    );
  if (image.isPending || set.isPending)
    return <DialogNotice message='Loading viewer...' onClose={onClose} />;
  if (!image.data || !set.data || image.data.projectId !== set.data.projectId) {
    return (
      <DialogNotice
        message='This image or annotation set is unavailable.'
        onClose={onClose}
      />
    );
  }
  return props.editable ? (
    <AnnotationViewerModal
      key={imageId}
      show
      {...props}
      imageMeta={image.data}
    />
  ) : (
    <ImageViewerModal key={imageId} show {...props} />
  );
}
