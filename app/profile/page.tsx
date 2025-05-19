import ProfileInfo from '@/components/ui/ProfileInfo/ProfileInfo';
import { StatusType } from '@/components/ui/Status/Status';
import React from 'react';

const page = () => {
  const sampleProfile = {
    profilePicture: 'https://picsum.photos/200',
    name: 'Anders Christensen',
    title: 'UI Designer',
    status: 'from home' as StatusType,
    phoneNumber: '+45 87 18 91 28',
    email: 'anders@work.com',
    department: 'Design',
  };
  return (
    <div>
      <ProfileInfo user={sampleProfile} />
    </div>
  );
};

export default page;
