"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"

import { Input } from "@/components/ui/input"
import {Button} from "@/components/ui/Button/Button";

// 1. Update schema to include "status"
const formSchema = z.object({
    username: z.string().min(2, {
        message: "Username must be at least 2 characters.",
    }),
    status: z.string().optional(), // Make it required if you want to enforce always present
})

export function StatusForm() {
    // 2. Add "status" to defaultValues
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            username: "",
            status: "", // default empty, could use undefined if .optional()
        },
    })

    // 3. Update handler to show status too
    function onSubmit(values: z.infer<typeof formSchema>) {
        // eslint-disable-next-line no-console
        console.log(values)    }

    // 4. Button handler to set status
    function handleSetStatus(status:string) {
        form.setValue("status", status)
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                                <div className="flex gap-2">
                                  <Input placeholder="shadcn" {...field} />
                                  <Button ariaLabel="status-button" handleClick={()=>handleSetStatus('from-homies')}>
                                      From Home
                                  </Button>
                                </div>
                            </FormControl>
                            <FormDescription>
                                This is your public display name.
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                {/* Optionally display the status value */}
                <div>Status: {form.watch("status") || "(none set)"}</div>
                <button type="submit">Submit</button>
            </form>
        </Form>
    )
}