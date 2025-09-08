import React, { forwardRef, useState, ReactElement } from 'react';
import {
  Modal as BootstrapModal,
  ModalProps as BootstrapModalProps,
  ModalBody,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  Button,
} from 'react-bootstrap';
import { ArrowLeft } from 'lucide-react';

// Re-export components for easier imports
export const Footer = ModalFooter;
export const Title = ModalTitle;
export const Body = ModalBody;
export const Header = ModalHeader;

/**
 * Custom Modal Component - Enhanced Bootstrap Modal with additional features
 *
 * This component extends React Bootstrap's Modal with several enhancements:
 * - Strict mode: Removes close button and prevents backdrop/keyboard dismissal
 * - Help system: Optional help overlay with custom component support
 * - Disabled state: Disables all form elements within the modal
 *
 * @example
 * ```tsx
 * import { Modal, Header, Title, Body, Footer } from './Modal';
 *
 * // Basic modal with help
 * const HelpContent = () => <div>Help information...</div>;
 *
 * <Modal
 *   show={show}
 *   onHide={() => setShow(false)}
 *   strict={true}
 *   helpComponent={HelpContent}
 *   helpButtonText="?"
 *   disabled={isLoading}
 * >
 *   <Header>
 *     <Title>My Modal</Title>
 *   </Header>
 *   <Body className="p-4">
 *     <p>Modal content here...</p>
 *   </Body>
 *   <Footer>
 *     <Button>Close</Button>
 *   </Footer>
 * </Modal>
 * ```
 */
interface CustomModalProps extends BootstrapModalProps {
  /** When true, removes close button and prevents backdrop/keyboard dismissal */
  strict?: boolean;
  /** Component to render in the help overlay */
  helpComponent?: React.ComponentType;
  /** Text for the help button (defaults to "Help") */
  helpButtonText?: string;
  /** When true, disables all form elements within the modal */
  disabled?: boolean;
}

/**
 * Enhanced Modal component with additional features beyond standard Bootstrap Modal
 */
const CustomModal = forwardRef<HTMLDivElement, CustomModalProps>(
  (
    {
      strict = false,
      helpComponent: HelpComponent,
      helpButtonText = 'Help',
      disabled = false,
      children,
      size = 'xl',
      backdrop,
      keyboard,
      ...props
    },
    ref
  ) => {
    const [showHelp, setShowHelp] = useState(false);

    // Handle strict mode props
    const modalBackdrop = strict ? 'static' : backdrop;
    const modalKeyboard = strict ? false : keyboard;

    // Separate children into different parts
    let modalHeader: ReactElement | null = null;
    let modalFooter: ReactElement | null = null;
    let modalBodyChildren: ReactElement[] = [];

    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child)) {
        if (child.type === ModalHeader) {
          modalHeader = child;
        } else if (child.type === ModalFooter) {
          modalFooter = child;
        } else if (child.type !== ModalBody) {
          // If it's not ModalBody, ModalHeader, or ModalFooter, treat it as body content
          modalBodyChildren.push(child);
        }
      }
    });

    // If there's a ModalBody, use its children
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child) && child.type === ModalBody) {
        const modalBodyElement = child as React.ReactElement<any>;
        React.Children.forEach(modalBodyElement.props.children, (bodyChild) => {
          if (React.isValidElement(bodyChild)) {
            modalBodyChildren.push(bodyChild);
          }
        });
      }
    });

    // Create custom header with controls
    const renderHeaderContent = () => {
      if (!modalHeader) return null;
      return React.cloneElement(modalHeader!, {
        className: modalHeader!.props.className,
        style: {
          ...modalHeader!.props.style,
          flex: 1,
          padding: 0,
          backgroundColor: 'transparent',
          border: 'none',
        },
      });
    };

    const customHeader = (
      <ModalHeader>
        <div className='d-flex justify-content-between align-items-center w-100'>
          <div>{renderHeaderContent()}</div>
          <div className='d-flex align-items-center gap-2'>
            {HelpComponent && (
              <Button variant='info' onClick={() => setShowHelp(!showHelp)}>
                {showHelp ? 'Hide' : helpButtonText}
              </Button>
            )}
            {!strict && (
              <Button
                variant='outline-secondary'
                size='sm'
                onClick={props.onHide}
                aria-label='Close'
              >
                ×
              </Button>
            )}
          </div>
        </div>
      </ModalHeader>
    );

    return (
      <BootstrapModal
        ref={ref}
        size={size}
        backdrop={modalBackdrop}
        keyboard={modalKeyboard}
        {...props}
      >
        {customHeader}

        <div style={{ position: 'relative' }}>
          <ModalBody
            style={{
              padding: 0,
              position: 'relative',
              minHeight: '200px',
            }}
          >
            <fieldset
              disabled={disabled}
              style={{
                border: 'none',
                margin: 0,
                padding: 0,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {modalBodyChildren}
            </fieldset>
          </ModalBody>

          {modalFooter}

          {/* Help overlay - covers entire content area except header */}
          {showHelp && HelpComponent && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: '#4E5D6C',
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  padding: '16px',
                  borderBottom: '1px solid #dee2e6',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Button
                  className='d-flex align-items-center gap-2 px-2 py-1'
                  onClick={() => setShowHelp(false)}
                  style={{ padding: 0, color: '#fff' }}
                >
                  <ArrowLeft size={16} />
                  <span>Back</span>
                </Button>
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
                <HelpComponent />
              </div>
            </div>
          )}
        </div>
      </BootstrapModal>
    );
  }
);

CustomModal.displayName = 'CustomModal';

// Export as named export
export { CustomModal as Modal };

// Also export as default for backward compatibility
export default CustomModal;
