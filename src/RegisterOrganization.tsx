import { useState } from 'react';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';

/*
    Send an email to superadmin
    Optionally record info in DB to show in admin dashboard
*/

export default function RegisterOrganization() {
  return (
    <Card className="w-50 mx-auto mt-5">
      <Card.Body>
        <Card.Title className="text-center">Register Organization</Card.Title>
        <Form className="d-flex flex-column gap-3">
          <Form.Group>
            <Form.Label>Organization Name</Form.Label>
            <Form.Control type="text" placeholder="Enter organization name" />
          </Form.Group>
          <Form.Group>
            <Form.Label> Email</Form.Label>
            <Form.Control type="email" placeholder="Enter email" />
          </Form.Group>
          <Form.Group>
            <Form.Label>Brief Description of Work</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter brief description of work"
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>What is 2 + 1?</Form.Label>
            <Form.Control type="text" placeholder="Enter the answer" />
          </Form.Group>
          <Button type="submit" variant="info">
            Submit
          </Button>
        </Form>
      </Card.Body>
    </Card>
  );
}
