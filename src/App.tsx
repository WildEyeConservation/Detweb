export function graphqlOperation(query: string, variables: any) {
  return { query, variables };
}

import { useEffect, useState } from 'react';
import './App.css';
import 'leaflet/dist/leaflet.css';
import { configure } from 'react-hotkeys';
import { withAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { User } from './UserContext.js';
import 'bootswatch/dist/superhero/bootstrap.min.css';
import { fetchAuthSession, AuthUser } from 'aws-amplify/auth';
import { BrowserView, MobileView } from 'react-device-detect';
import MainNavigation from './MainNavigation.tsx';
//import { ErrorHandler } from './ErrorHandler';
//import {TaskProgressHandler} from './TaskProgressHandler';

configure({ ignoreRepeatedEventsWhenKeyHeldDown: false });

/**
 *
 * The root component for the ESS frontend map. Renders the Navbar and the router that selects which of the other pages
 * to render based on th current URL.
 * @component
 *
 */
interface AppProps {
  signOut?: () => void;
  user?: AuthUser;
}

function App({ signOut = () => {}, user }: AppProps) {
  const [session, setSession] = useState<any>();
  const [cognitoGroups, setCognitoGroups] = useState<string[]>([]);
  // const [userAttributes, setUserAttributes] = useState<any>(null);

  // useEffect(() => {
  //   // fetchUserAttributes().then((attributes) => setUserAttributes(attributes));
  // }, [user]);

  // let handleSelect = async function (key: string | null) {
  //   if (key == "addFiles") {
  //     setDirHandle(await (window as any).showDirectoryPicker());
  //   }
  //   setModalToShow(key);
  // };


  useEffect(() => {
    window.addEventListener('beforeunload', alertUser);
    return () => {
      window.removeEventListener('beforeunload', alertUser);
    };
  }, []);
  const alertUser = (e: BeforeUnloadEvent) => {
    alert(
      'If you use refresh to load new data it may result in some of your work being lost.'
    );
    e.preventDefault();
    e.returnValue = '';
  };
  useEffect(() => {
    fetchAuthSession().then((sess) => {
      setSession(sess);
      if (sess?.tokens?.accessToken?.payload['cognito:groups']) {
        setCognitoGroups(
          sess.tokens.accessToken.payload['cognito:groups'] as string[]
        );
      }
    });
  }, [user]);


  return (
    session && (
      <>
        <BrowserView>
          <User user={user!} cognitoGroups={cognitoGroups}>
            <MainNavigation signOut={signOut} />
          </User>
        </BrowserView>
        <MobileView>
          <p>
            {' '}
            This application is not supported on mobile devices. Please open on
            a laptop or desktop device.
          </p>
        </MobileView>
      </>
    )
  );
}

export default withAuthenticator(App);
