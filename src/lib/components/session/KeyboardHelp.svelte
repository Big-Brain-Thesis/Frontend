<script lang="ts">
  let isOpen = false;

  const sections = [
    {
      title: 'Game Controls',
      rows: [
        { keys: ['N'], description: 'New game' },
        { keys: ['R'], description: 'Reset game' },
        { keys: ['E'], description: 'Toggle EEG monitoring' }
      ]
    },
    {
      title: 'Console',
      rows: [
        { keys: ['C'], description: 'Toggle debug console' },
        { keys: ['F'], description: 'Filter console by category' }
      ]
    },
    {
      title: 'Navigation',
      rows: [
        { keys: ['?'], description: 'Show or hide help' },
        { keys: ['Esc'], description: 'Close dialogs' }
      ]
    }
  ];
</script>
