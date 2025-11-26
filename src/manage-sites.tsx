import {
  Action,
  ActionPanel,
  Alert,
  Clipboard,
  Color,
  Form,
  Icon,
  List,
  Toast,
  confirmAlert,
  showToast,
} from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import { SiteProfile, SiteInput, getSites, removeSite, upsertSite } from "./storage/sites";
import { buildApiUrl } from "./api/wordpress";

export default function ManageSitesCommand() {
  const [sites, setSites] = useState<SiteProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    refreshSites();
  }, []);

  async function refreshSites() {
    setIsLoading(true);
    const storedSites = await getSites();
    setSites(storedSites);
    setIsLoading(false);
  }

  async function handleDelete(site: SiteProfile) {
    const shouldDelete = await confirmAlert({
      title: `Delete ${site.name}?`,
      message: "This will remove the stored credentials and site profile.",
      icon: { source: Icon.Trash, tintColor: Color.Red },
      primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
    });

    if (!shouldDelete) return;

    await removeSite(site.id);
    await refreshSites();
    await showToast({ style: Toast.Style.Success, title: "Site removed" });
  }

  async function handleSave(values: SiteInput) {
    const toast = await showToast({ style: Toast.Style.Animated, title: "Saving site" });
    try {
      const savedSite = await upsertSite(values);
      toast.style = Toast.Style.Success;
      toast.title = values.id ? "Site updated" : "Site added";
      toast.message = savedSite.name;
      await refreshSites();
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Unable to save site";
      toast.message = error instanceof Error ? error.message : "Unexpected error";
      throw error;
    }
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Filter sites">
      <List.EmptyView
        title="No sites configured"
        description="Add a WordPress site to get started"
        actions={
          <ActionPanel>
            <Action.Push
              title="Add Site"
              icon={Icon.Plus}
              target={<SiteForm onSave={handleSave} />}
            />
          </ActionPanel>
        }
        icon={Icon.Plus}
      />

      {sites.map((site) => (
        <List.Item
          key={site.id}
          title={site.name}
          subtitle={site.baseUrl}
          accessories={[
            { text: site.credentials.username },
            { date: site.validatedAt ? new Date(site.validatedAt) : undefined },
          ]}
          actions={
            <ActionPanel>
              <AddSiteAction onSave={handleSave} initialSite={site} />
              <Action
                title="Validate Connection"
                icon={Icon.CheckCircle}
                onAction={() =>
                  handleSave({
                    ...site,
                    username: site.credentials.username,
                    applicationPassword: site.credentials.applicationPassword,
                  })
                }
              />
              <Action title="Copy API Base" icon={Icon.LinkClipboard} onAction={() => copyApiBase(site)} />
              <Action
                title="Delete Site"
                icon={Icon.Trash}
                style={Action.Style.Destructive}
                onAction={() => handleDelete(site)}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

function AddSiteAction({
  onSave,
  initialSite,
}: {
  onSave: (values: SiteInput) => Promise<void>;
  initialSite?: SiteProfile;
}) {
  return (
    <Action.Push
      title={initialSite ? "Edit Site" : "Add Site"}
      icon={initialSite ? Icon.Pencil : Icon.Plus}
      target={<SiteForm initialSite={initialSite} onSave={onSave} />}
    />
  );
}

function SiteForm({
  onSave,
  initialSite,
}: {
  onSave: (values: SiteInput) => Promise<void>;
  initialSite?: SiteProfile;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultValues = useMemo(() => {
    if (!initialSite) return undefined;

    return {
      ...initialSite,
      username: initialSite.credentials.username,
      applicationPassword: initialSite.credentials.applicationPassword,
    };
  }, [initialSite]);

  const handleSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      await onSave({
        id: initialSite?.id,
        name: values.name,
        baseUrl: values.baseUrl,
        restBase: values.restBase,
        username: values.username,
        applicationPassword: values.applicationPassword,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form
      isLoading={isSubmitting}
      actions={
        <ActionPanel>
          <Action.SubmitForm title={initialSite ? "Save Changes" : "Add Site"} onSubmit={handleSubmit} />
        </ActionPanel>
      }
      enableDrafts
      navigationTitle={initialSite ? "Edit Site" : "Add WordPress Site"}
      defaultValues={defaultValues}
    >
      <Form.TextField id="name" title="Site Name" placeholder="My Blog" autoFocus />
      <Form.TextField id="baseUrl" title="Base URL" placeholder="https://example.com" />
      <Form.TextField id="restBase" title="REST Base" defaultValue="/wp-json/wp/v2/" placeholder="/wp-json/wp/v2/" />
      <Form.Separator />
      <Form.TextField id="username" title="Username" autoCapitalize={Form.TextField.AutoCapitalize.None} />
      <Form.PasswordField id="applicationPassword" title="Application Password" />
    </Form>
  );
}

async function copyApiBase(site: SiteProfile) {
  const url = buildApiUrl({ baseUrl: site.baseUrl, restBase: site.restBase }, "");
  await Clipboard.copy(url);
  await showToast({ style: Toast.Style.Success, title: "Copied API base", message: url });
}

interface FormValues {
  name: string;
  baseUrl: string;
  restBase: string;
  username: string;
  applicationPassword: string;
}
