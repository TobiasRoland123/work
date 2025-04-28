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
  password: z.string().min(1, { message: 'Password is required.' }),
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
    <section className=" w-full h-80 lg:absolute lg:w-[503px] lg:h-full lg:right-0 lg:top-0 px-4 py-10 bg-white flex flex-col gap-20 lg:pb-0">
      <Form {...form}>
        <form
          className="h-full flex flex-col"
          onSubmit={form.handleSubmit((data) => {
            console.log(data);
          })}
        >
          <div className="flex flex-col gap-8 lg:mt-10">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <div className="flex justify-between">
                    <div className="mt-6">
                      <FormLabel className="font-mono">Name</FormLabel>
                    </div>
                    <div className="flex flex-col w-full max-w-60 lg:max-w-[348px]">
                      <FormControl>
                        <Input
                          className="rounded-none border-t-0 border-l-0 border-r-0 border-b-1 border-b-black font-normal text-24 w-full focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-0"
                          placeholder="Lars Larsen"
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
                      <FormLabel className=" font-mono">Password</FormLabel>
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
            <Button variant="large">Log ind</Button>
          </div>
        </form>
      </Form>
    </section>
  );
};

export default LoginForm;
