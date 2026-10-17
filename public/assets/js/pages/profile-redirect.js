const destination = new URL('seeker_edit_profile.html', location.href);
destination.search = location.search;
destination.hash = location.hash;
location.replace(destination);
