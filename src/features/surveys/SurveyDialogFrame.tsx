import { Suspense, type ReactNode } from 'react';
import { Button, Modal } from 'react-bootstrap';
import type { SurveyDialogKind } from './surveyDialogRoutes';

function surveyDialogPresentation(
  kind: SurveyDialogKind,
  projectName?: string,
  setName?: string,
  resume = false
) {
  const titles: Record<SurveyDialogKind, string> = {
    newSurvey: 'New Survey',
    addFiles: `${resume ? 'Resume upload' : 'Add files'}${projectName ? `: ${projectName}` : ''}`,
    addAnnotationSet: 'Add Annotation Set',
    annotationCount: 'Annotation Set Details',
    editAnnotationSet: 'Edit Annotation Set',
    annotationSetResults: setName ? `${setName} Results` : 'Annotation Set Results',
    launchAnnotationSet: 'Launch for Manual Annotation',
    generateJollyResults: 'Generate Jolly Results',
  };
  return {
    title: titles[kind],
    size: (['annotationCount', 'annotationSetResults', 'launchAnnotationSet', 'generateJollyResults'].includes(kind) ? 'lg' : 'xl') as 'lg' | 'xl',
    backdrop: kind === 'annotationCount' ? true as const : 'static' as const,
    keyboard: kind === 'annotationCount' || kind === 'generateJollyResults',
  };
}

export default function SurveyDialogFrame({
  kind,
  projectName,
  setName,
  resume,
  identity,
  message,
  onClose,
  children,
}: {
  kind: SurveyDialogKind;
  projectName?: string;
  setName?: string;
  resume?: boolean;
  identity: string;
  message?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const presentation = surveyDialogPresentation(kind, projectName, setName, resume);
  const status = (text: string) => (
    <>
      <Modal.Header><Modal.Title>{presentation.title}</Modal.Title></Modal.Header>
      <Modal.Body><p role='status' className='mb-0'>{text}</p></Modal.Body>
      <Modal.Footer><Button variant='dark' onClick={onClose}>Close</Button></Modal.Footer>
    </>
  );

  // The portal, backdrop and focus trap remain mounted through both the data
  // fetch and the lazy import. Loaded dialogs supply contents, never a portal.
  return (
    <Modal show onHide={onClose} size={presentation.size}
      backdrop={presentation.backdrop} keyboard={presentation.keyboard}
      aria-label={presentation.title}>
      {message ? status(message) : (
        <Suspense key={identity} fallback={status('Loading...')}>
          {children}
        </Suspense>
      )}
    </Modal>
  );
}
