update public.organization_permissions
set permission_type='screen',
    screen_key='screen.connector_management.view',
    route_path='/workspace/data-monitoring/connectors',
    category='data',
    sort_order=36
where permission_key='connector.view';
