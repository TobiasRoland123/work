'use client';

import React from 'react';
import { Button } from '../Button/Button';
import { zodResolver } from '@hookform/resolvers/zod';

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
  name: z.string().min(2, {
    message: 'Username must be at least 2 characters.',
  }),
  password: z.string(),
});

const LoginForm = () => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      password: '',
    },
  });

  return (
    <div className="absolute bottom-0 w-full h-80 lg:w-[503px] lg:h-full lg:right-0 px-4 py-10 bg-white flex flex-col gap-20 lg:pb-0">
      <Form {...form}>
        <div className="flex flex-col gap-8 lg:mt-10">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <div className="flex gap-11 justify-between">
                  <FormLabel className="items-end font-mono">Name</FormLabel>
                  <FormControl>
                    <Input
                      className="rounded-none border-t-0 border-l-0 border-r-0 border-b-1 border-b-black font-normal text-2xl lg:text-2xl  max-w-60 lg:max-w-[348px] focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-0"
                      placeholder="Lars Larsen"
                      {...field}
                    />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex gap-11 justify-between">
                  <FormLabel className="items-end font-mono">Password</FormLabel>
                  <FormControl>
                    <Input
                      className="rounded-none border-t-0 border-l-0 border-r-0 border-b-1 border-b-black font-normal text-2xl lg:text-2xl max-w-60 lg:max-w-[348px] focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-0"
                      {...field}
                      type="password"
                    />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="mt-auto py-5">
          <Button variant="large">Log ind</Button>
        </div>
      </Form>
    </div>
  );
};

export default LoginForm;
