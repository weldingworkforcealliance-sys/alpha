// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ContactForm from '../app/contact/contact-form';
afterEach(()=>{cleanup();vi.unstubAllGlobals();window.history.replaceState({},'', '/');});
it('preselects a demo, sends the requested fields, and confirms a saved inquiry',async()=>{
  window.history.replaceState({},'', '/contact?interest=demo&source=home-nav&utm_source=newsletter');
  const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({challenge:'signed-token'})}).mockResolvedValueOnce({ok:true,json:async()=>({ok:true})});vi.stubGlobal('fetch',fetcher);
  render(<ContactForm />);
  await waitFor(()=>expect((screen.getByRole('button',{name:'Request Information'}) as HTMLButtonElement).disabled).toBe(false));
  expect((screen.getByLabelText('What are you interested in? *') as HTMLSelectElement).value).toBe('LTG demonstration');
  fireEvent.change(screen.getByLabelText('Name *'),{target:{value:'Test Contact'}});
  fireEvent.change(screen.getByLabelText('Institution / Organization *'),{target:{value:'Example School'}});
  fireEvent.change(screen.getByLabelText('Work Email *'),{target:{value:'test@example.com'}});
  fireEvent.submit(screen.getByRole('button',{name:'Request Information'}).closest('form')!);
  await screen.findByText('Thank you for reaching out.');
  const body=JSON.parse(fetcher.mock.calls[1][1].body);
  expect(body).toMatchObject({name:'Test Contact',institution:'Example School',email:'test@example.com',inquiry_type:'LTG demonstration',source_page:'/#navigation',utm_source:'newsletter',challenge:'signed-token'});
});
it('retains form values when saving fails and permits retry',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({challenge:'signed-token'})}).mockResolvedValueOnce({ok:false,json:async()=>({error:'Please try again.'})});vi.stubGlobal('fetch',fetcher);render(<ContactForm />);
  await waitFor(()=>expect((screen.getByRole('button',{name:'Request Information'}) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText('Name *'),{target:{value:'Retained Name'}});
  fireEvent.submit(screen.getByRole('button',{name:'Request Information'}).closest('form')!);
  await screen.findByText('Please try again.');expect((screen.getByLabelText('Name *') as HTMLInputElement).value).toBe('Retained Name');
});
