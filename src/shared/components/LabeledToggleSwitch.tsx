import React from 'react';
import { Form, Row, Col } from 'react-bootstrap';

interface LabeledToggleSwitchProps {
  leftLabel: string;
  rightLabel: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
}

const LabeledToggleSwitch: React.FC<LabeledToggleSwitchProps> = ({
  leftLabel,
  rightLabel,
  checked,
  onChange,
  className,
  disabled,
}) => {
  return (
    <Form.Group
      as={Row}
      className={`${className || 'mb-3 align-items-center'}`}
    >
      <Col xs={4} className='text-end'>
        <Form.Label className='mb-0'>{leftLabel}</Form.Label>
      </Col>
      <Col xs={4} className='d-flex justify-content-center'>
        <Form.Check
          type='switch'
          id='custom-switch'
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
      </Col>
      <Col xs={4}>
        <Form.Label className='mb-0'>{rightLabel}</Form.Label>
      </Col>
    </Form.Group>
  );
};

export default LabeledToggleSwitch;
