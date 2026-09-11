import React from 'react';

interface ProfileInfoFieldProps {
  label: string;
  value: string;
  href?: string;
}

const ProfileInfoField = ({ label, value, href }: ProfileInfoFieldProps) => {
  return (
    <div className="profile-info__field">
      <div className="profile-info__field-label">
        <p>{label}</p>
      </div>
      <div className="profile-info__field-value">
        {href ? <a href={href}>{value}</a> : <p>{value}</p>}
      </div>
    </div>
  );
};

export default ProfileInfoField;
