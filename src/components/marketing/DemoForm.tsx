'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Send, CheckCircle2, Loader2 } from 'lucide-react';

const demoRequestSchema = z.object({
  restaurant_name: z
    .string()
    .min(1, 'Restaurant name is required')
    .max(200, 'Restaurant name is too long'),
  contact_name: z
    .string()
    .min(1, 'Your name is required')
    .max(100, 'Name is too long'),
  email: z.string().email('Please enter a valid email address'),
  phone: z
    .string()
    .min(10, 'Please enter a valid phone number')
    .max(20, 'Phone number is too long')
    .regex(
      /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/,
      'Please enter a valid phone number'
    ),
  locations_count: z
    .number()
    .min(1, 'At least 1 location')
    .max(999, 'Please contact us directly for 1000+ locations'),
  current_pos: z.enum(
    ['toast', 'square', 'spoton', 'clover', 'rpower', 'other', 'none'],
    { message: 'Please select your current POS' }
  ),
});

type DemoRequestFormData = z.infer<typeof demoRequestSchema>;

const posOptions = [
  { value: '', label: 'Select your current POS...' },
  { value: 'toast', label: 'Toast' },
  { value: 'square', label: 'Square' },
  { value: 'spoton', label: 'SpotOn' },
  { value: 'clover', label: 'Clover' },
  { value: 'rpower', label: 'R Power' },
  { value: 'other', label: 'Other' },
  { value: 'none', label: 'No POS yet' },
] as const;

export function DemoForm() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DemoRequestFormData>({
    resolver: zodResolver(demoRequestSchema),
    defaultValues: {
      locations_count: 1,
    },
  });

  const onSubmit = async (data: DemoRequestFormData) => {
    setServerError('');
    try {
      const res = await fetch('/api/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          source_page: window.location.pathname,
          utm_params: Object.fromEntries(
            new URLSearchParams(window.location.search)
          ),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error || 'Something went wrong. Please try again.'
        );
      }

      setSubmitted(true);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Something went wrong.'
      );
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-[#34C759]/20 bg-[#34C759]/5 p-10 text-center">
        <CheckCircle2 size={48} className="mx-auto text-[#34C759]" />
        <h3 className="mt-5 text-[22px] font-semibold text-[#1C1C1E]">
          We&apos;ll be in touch!
        </h3>
        <p className="mt-3 text-[15px] leading-relaxed text-[#78756D]">
          Check your email for a confirmation with next steps. We typically
          respond within 2 business hours.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mx-auto max-w-lg space-y-5"
      noValidate
    >
      {/* Restaurant Name */}
      <div>
        <label
          htmlFor="restaurant_name"
          className="mb-1.5 block text-[14px] font-medium text-[#3D3D37]"
        >
          Restaurant name
        </label>
        <input
          id="restaurant_name"
          type="text"
          placeholder="The Copper Pot"
          {...register('restaurant_name')}
          className="w-full rounded-xl border border-[rgba(60,60,67,0.12)] bg-white px-4 py-3 text-[16px] text-[#1C1C1E] placeholder-[#A1A1A6] transition-colors focus:border-[#F06B18] focus:outline-none focus:ring-2 focus:ring-[#F06B18]/20"
        />
        {errors.restaurant_name && (
          <p className="mt-1 text-[13px] text-[#FF3B30]">
            {errors.restaurant_name.message}
          </p>
        )}
      </div>

      {/* Contact Name */}
      <div>
        <label
          htmlFor="contact_name"
          className="mb-1.5 block text-[14px] font-medium text-[#3D3D37]"
        >
          Your name
        </label>
        <input
          id="contact_name"
          type="text"
          placeholder="Maria Gonzalez"
          {...register('contact_name')}
          className="w-full rounded-xl border border-[rgba(60,60,67,0.12)] bg-white px-4 py-3 text-[16px] text-[#1C1C1E] placeholder-[#A1A1A6] transition-colors focus:border-[#F06B18] focus:outline-none focus:ring-2 focus:ring-[#F06B18]/20"
        />
        {errors.contact_name && (
          <p className="mt-1 text-[13px] text-[#FF3B30]">
            {errors.contact_name.message}
          </p>
        )}
      </div>

      {/* Email & Phone row */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-[14px] font-medium text-[#3D3D37]"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            placeholder="maria@copperpot.com"
            {...register('email')}
            className="w-full rounded-xl border border-[rgba(60,60,67,0.12)] bg-white px-4 py-3 text-[16px] text-[#1C1C1E] placeholder-[#A1A1A6] transition-colors focus:border-[#F06B18] focus:outline-none focus:ring-2 focus:ring-[#F06B18]/20"
          />
          {errors.email && (
            <p className="mt-1 text-[13px] text-[#FF3B30]">
              {errors.email.message}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="phone"
            className="mb-1.5 block text-[14px] font-medium text-[#3D3D37]"
          >
            Phone
          </label>
          <input
            id="phone"
            type="tel"
            placeholder="(555) 123-4567"
            {...register('phone')}
            className="w-full rounded-xl border border-[rgba(60,60,67,0.12)] bg-white px-4 py-3 text-[16px] text-[#1C1C1E] placeholder-[#A1A1A6] transition-colors focus:border-[#F06B18] focus:outline-none focus:ring-2 focus:ring-[#F06B18]/20"
          />
          {errors.phone && (
            <p className="mt-1 text-[13px] text-[#FF3B30]">
              {errors.phone.message}
            </p>
          )}
        </div>
      </div>

      {/* Locations & Current POS */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="locations_count"
            className="mb-1.5 block text-[14px] font-medium text-[#3D3D37]"
          >
            Number of locations
          </label>
          <input
            id="locations_count"
            type="number"
            min={1}
            max={999}
            {...register('locations_count', { valueAsNumber: true })}
            className="w-full rounded-xl border border-[rgba(60,60,67,0.12)] bg-white px-4 py-3 text-[16px] text-[#1C1C1E] placeholder-[#A1A1A6] transition-colors focus:border-[#F06B18] focus:outline-none focus:ring-2 focus:ring-[#F06B18]/20"
          />
          {errors.locations_count && (
            <p className="mt-1 text-[13px] text-[#FF3B30]">
              {errors.locations_count.message}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="current_pos"
            className="mb-1.5 block text-[14px] font-medium text-[#3D3D37]"
          >
            Current POS
          </label>
          <select
            id="current_pos"
            {...register('current_pos')}
            className="w-full rounded-xl border border-[rgba(60,60,67,0.12)] bg-white px-4 py-3 text-[16px] text-[#1C1C1E] transition-colors focus:border-[#F06B18] focus:outline-none focus:ring-2 focus:ring-[#F06B18]/20"
          >
            {posOptions.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={!opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {errors.current_pos && (
            <p className="mt-1 text-[13px] text-[#FF3B30]">
              {errors.current_pos.message}
            </p>
          )}
        </div>
      </div>

      {/* Server error */}
      {serverError && (
        <div className="rounded-xl border border-[#FF3B30]/20 bg-[#FEF2F2] p-4 text-[14px] text-[#FF3B30]">
          {serverError}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="btn-press flex w-full items-center justify-center gap-2 rounded-full bg-[#F06B18] py-4 text-[17px] font-semibold text-white shadow-lg shadow-[#F06B18]/25 transition-all hover:bg-[#E05A0A] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Send size={18} />
            Request a Demo
          </>
        )}
      </button>

      <p className="text-center text-[13px] text-[#78756D]">
        No spam. No pressure. We&apos;ll reach out within 2 business hours.
      </p>
    </form>
  );
}
