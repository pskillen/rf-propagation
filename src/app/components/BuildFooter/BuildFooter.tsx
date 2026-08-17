export default function BuildFooter() {
  return (
    <footer
      style={{
        marginTop: '2rem',
        paddingTop: '0.75rem',
        borderTop: '1px solid #e2e8f0',
        color: '#64748b',
        fontSize: '0.875rem',
        textAlign: 'center',
      }}
    >
      {__BUILD_ENV__} · {__BUILD_VERSION__}
    </footer>
  );
}
