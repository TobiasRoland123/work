'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '../Button/Button';

const LoginForm = () => {
  const [csrfToken, setCsrfToken] = useState<string>('');

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
    <section className="w-full lg:w-[503px] lg:h-full lg:right-0 lg:top-0 px-4 py-10 bg-white flex flex-col justify-end">
      <form
        action="/api/auth/signin/microsoft-entra-id"
        method="POST"
        className="w-full h-full flex flex-col justify-end"
      >
        <div className="relative flex flex-col items-center w-full">
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <input type="hidden" name="callbackUrl" value="/" />
          <Button ariaLabel="log in" variant="large">
            {'Log ind'}
          </Button>
        </div>
      </form>
    </section>
  );
};

export default LoginForm;
