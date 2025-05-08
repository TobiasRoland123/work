'use client';

import React, { useEffect, useState } from 'react';
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

import Image from 'next/image';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

const LoginForm = () => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string>('');

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

  useEffect(() => {
    const getCsrfToken = () => {
      const cookies = document.cookie.split(';');
      const csrfCookie = cookies.find((cookie) =>
        cookie.trim().startsWith('next-auth.csrf-token=')
      );

      if (csrfCookie) {
        const token = csrfCookie.split('=')[1].split('%')[0];
        setCsrfToken(token);
      } else {
        // Fetch token from API if not in cookies
        fetch('/api/auth/csrf')
          .then((res) => res.json())
          .then((data) => {
            if (data.csrfToken) {
              setCsrfToken(data.csrfToken);
            }
          })
          .catch((err) => console.error('Failed to fetch CSRF token:', err));
      }
    };

    getCsrfToken();
  }, []);

  return (
    <section className="w-full h-80 lg:w-[503px] lg:h-full lg:right-0 lg:top-0 px-4 py-10 bg-white flex flex-col">
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
                  <div className="flex gap-20 justify-between">
                    <div className="mt-5">
                      <FormLabel className="font-mono w-24 text-base">Email</FormLabel>
                    </div>
                    <div className="flex flex-col w-full lg:max-w-[348px]">
                      <FormControl>
                        <Input
                          className="rounded-none border-t-0 border-l-0 border-r-0 border-b-1 border-b-black font-normal text-2xl md:text-2xl lg:text-2xl w-full focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-0"
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
                  <div className="flex gap-20 justify-between">
                    <div className="mt-5">
                      <FormLabel className="font-mono w-24 text-base">Password</FormLabel>
                    </div>
                    <div className="flex flex-col w-full lg:max-w-[348px]">
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

      <form
        action="http://localhost:3000/api/auth/signin/microsoft-entra-id"
        method="POST"
        className="w-full"
      >
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <input type="hidden" name="callbackUrl" value="/" />
        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 border border-gray-300 bg-white py-3 px-4 text-black hover:bg-gray-50 transition-colors rounded-2xl"
        >
          <span>Sign in with Microsoft Entra ID</span>
          <Image
            loading="lazy"
            height="24"
            width="24"
            src="https://authjs.dev/img/providers/microsoft-entra-id.svg"
            alt="Microsoft logo"
            className="mr-2"
          />
        </button>
      </form>
    </section>
  );
};

export default LoginForm;
