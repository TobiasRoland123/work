'use client';

import React, { useState } from 'react';
import { Button } from '../Button/Button';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

const LoginForm = () => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      setIsSubmitting(true);
      setError(null);

      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Login failed. Please try again.');
        return;
      }

      // Redirect to dashboard on success
      router.push('/today');
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Login error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="w-full h-80 lg:absolute lg:w-[503px] lg:h-full lg:right-0 lg:top-0 px-4 py-10 bg-white flex flex-col gap-20 lg:pb-0">
      <Form {...form}>
        <form className="h-full flex flex-col" onSubmit={form.handleSubmit(onSubmit)}>
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
          <div className="flex flex-col gap-8 lg:mt-10">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <div className="flex justify-between">
                    <div className="mt-6">
                      <FormLabel className="font-mono">Email</FormLabel>
                    </div>
                    <div className="flex flex-col w-full max-w-60 lg:max-w-[348px]">
                      <FormControl>
                        <Input
                          className="rounded-none border-t-0 border-l-0 border-r-0 border-b-1 border-b-black font-normal text-24 w-full focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-0"
                          placeholder="example@company.com"
                          type="email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="mt-1" />
                    </div>
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <div className="flex justify-between">
                    <div className="mt-6">
                      <FormLabel className="font-mono">Password</FormLabel>
                    </div>
                    <div className="flex flex-col w-full max-w-60 lg:max-w-[348px]">
                      <FormControl>
                        <Input
                          className="rounded-none border-t-0 border-l-0 border-r-0 border-b-1 border-b-black font-normal text-2xl lg:text-2xl w-full focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-0"
                          type="password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="mt-1" />
                    </div>
                  </div>
                </FormItem>
              )}
            />
          </div>
          <div className="mt-auto py-5">
            <Button variant="large">{isSubmitting ? 'Logging in...' : 'Log ind'}</Button>
          </div>
        </form>
      </Form>
    </section>
  );
};

export default LoginForm;
